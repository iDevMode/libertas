import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  IDestinationAdapter,
  SQLiteConfig,
  DestinationConfig,
  WriteResult,
  AdapterCapabilities,
  Transaction,
} from './interfaces.js';
import {
  NormalizedEntity,
  NormalizedProperty,
  NormalizedRelation,
  NormalizedContentBlock,
  NormalizedAttachment,
} from '../transformers/interfaces.js';
import { logger } from '../common/logger.js';

export class SQLiteAdapter implements IDestinationAdapter {
  private db: Database.Database | null = null;
  private config: SQLiteConfig | null = null;

  async connect(config: DestinationConfig): Promise<void> {
    if (config.type !== 'sqlite') {
      throw new Error('Invalid config type for SQLiteAdapter');
    }

    this.config = config;
    this.db = new Database(config.filepath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    logger.info({ filepath: config.filepath }, 'SQLite database connected');
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('SQLite database disconnected');
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.db) return false;
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    this.db.exec(`
      -- Entities table
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        parent_id TEXT,
        source_platform TEXT NOT NULL,
        source_url TEXT,
        metadata TEXT,
        FOREIGN KEY (parent_id) REFERENCES entities(id)
      );

      -- Properties table (EAV pattern)
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        property_name TEXT NOT NULL,
        property_type TEXT NOT NULL,
        value_text TEXT,
        value_number REAL,
        value_date TEXT,
        value_boolean INTEGER,
        value_json TEXT,
        position INTEGER DEFAULT 0,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      -- Relations table
      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        from_entity_id TEXT NOT NULL,
        to_entity_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      -- Content blocks table
      CREATE TABLE IF NOT EXISTS content_blocks (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        block_type TEXT NOT NULL,
        content TEXT,
        position INTEGER NOT NULL,
        parent_block_id TEXT,
        metadata TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_block_id) REFERENCES content_blocks(id) ON DELETE CASCADE
      );

      -- Attachments table
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        source_url TEXT,
        local_path TEXT,
        downloaded_at TEXT,
        metadata TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_id);
      CREATE INDEX IF NOT EXISTS idx_entities_platform ON entities(source_platform);
      CREATE INDEX IF NOT EXISTS idx_properties_entity ON properties(entity_id);
      CREATE INDEX IF NOT EXISTS idx_properties_name ON properties(property_name);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity_id);
      CREATE INDEX IF NOT EXISTS idx_content_blocks_entity ON content_blocks(entity_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_id);

      -- Full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
        title,
        content='entities',
        content_rowid='rowid'
      );
    `);

    logger.info('SQLite schema created');
  }

  async getExistingSchema(): Promise<boolean> {
    if (!this.db) throw new Error('Database not connected');

    const result = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entities'")
      .get();

    return !!result;
  }

  async beginTransaction(): Promise<Transaction> {
    if (!this.db) throw new Error('Database not connected');

    const transaction: Transaction = {
      id: uuidv4(),
      startedAt: new Date(),
    };

    this.db.exec('BEGIN TRANSACTION');
    return transaction;
  }

  async commit(_transaction: Transaction): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('COMMIT');
  }

  async rollback(_transaction: Transaction): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('ROLLBACK');
  }

  async writeEntities(entities: NormalizedEntity[]): Promise<WriteResult> {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entities (id, entity_type, title, created_at, updated_at, parent_id, source_platform, source_url, metadata)
      VALUES (@id, @entityType, @title, @createdAt, @updatedAt, @parentId, @sourcePlatform, @sourceUrl, @metadata)
    `);

    let inserted = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const entity of entities) {
      try {
        stmt.run({
          id: entity.id,
          entityType: entity.entityType,
          title: entity.title,
          createdAt: entity.createdAt?.toISOString(),
          updatedAt: entity.updatedAt?.toISOString(),
          parentId: entity.parentId,
          sourcePlatform: entity.sourcePlatform,
          sourceUrl: entity.sourceUrl,
          metadata: entity.metadata ? JSON.stringify(entity.metadata) : null,
        });
        inserted++;
      } catch (err) {
        failed++;
        errors.push({ id: entity.id, error: (err as Error).message });
      }
    }

    return { inserted, updated: 0, failed, errors: errors.length > 0 ? errors : undefined };
  }

  async writeProperties(properties: NormalizedProperty[]): Promise<WriteResult> {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO properties (id, entity_id, property_name, property_type, value_text, value_number, value_date, value_boolean, value_json, position)
      VALUES (@id, @entityId, @propertyName, @propertyType, @valueText, @valueNumber, @valueDate, @valueBoolean, @valueJson, @position)
    `);

    let inserted = 0;

    for (const prop of properties) {
      stmt.run({
        id: prop.id,
        entityId: prop.entityId,
        propertyName: prop.propertyName,
        propertyType: prop.propertyType,
        valueText: prop.valueText,
        valueNumber: prop.valueNumber,
        valueDate: prop.valueDate?.toISOString(),
        valueBoolean: prop.valueBoolean !== undefined ? (prop.valueBoolean ? 1 : 0) : null,
        valueJson: prop.valueJson ? JSON.stringify(prop.valueJson) : null,
        position: prop.position,
      });
      inserted++;
    }

    return { inserted, updated: 0, failed: 0 };
  }

  async writeRelations(relations: NormalizedRelation[]): Promise<WriteResult> {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO relations (id, from_entity_id, to_entity_id, relation_type, metadata)
      VALUES (@id, @fromEntityId, @toEntityId, @relationType, @metadata)
    `);

    let inserted = 0;

    for (const rel of relations) {
      stmt.run({
        id: rel.id,
        fromEntityId: rel.fromEntityId,
        toEntityId: rel.toEntityId,
        relationType: rel.relationType,
        metadata: rel.metadata ? JSON.stringify(rel.metadata) : null,
      });
      inserted++;
    }

    return { inserted, updated: 0, failed: 0 };
  }

  async writeContentBlocks(blocks: NormalizedContentBlock[]): Promise<WriteResult> {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO content_blocks (id, entity_id, block_type, content, position, parent_block_id, metadata)
      VALUES (@id, @entityId, @blockType, @content, @position, @parentBlockId, @metadata)
    `);

    let inserted = 0;

    for (const block of blocks) {
      stmt.run({
        id: block.id,
        entityId: block.entityId,
        blockType: block.blockType,
        content: block.content,
        position: block.position,
        parentBlockId: block.parentBlockId,
        metadata: block.metadata ? JSON.stringify(block.metadata) : null,
      });
      inserted++;
    }

    return { inserted, updated: 0, failed: 0 };
  }

  async writeAttachments(attachments: NormalizedAttachment[]): Promise<WriteResult> {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO attachments (id, entity_id, file_name, file_type, file_size, source_url, local_path, downloaded_at, metadata)
      VALUES (@id, @entityId, @fileName, @fileType, @fileSize, @sourceUrl, @localPath, @downloadedAt, @metadata)
    `);

    let inserted = 0;

    for (const att of attachments) {
      stmt.run({
        id: att.id,
        entityId: att.entityId,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize,
        sourceUrl: att.sourceUrl,
        localPath: att.localPath,
        downloadedAt: att.downloadedAt?.toISOString(),
        metadata: att.metadata ? JSON.stringify(att.metadata) : null,
      });
      inserted++;
    }

    return { inserted, updated: 0, failed: 0 };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsTransactions: true,
      supportsRelations: true,
      supportsBulkInsert: true,
      maxBatchSize: 1000,
      supportsJSONFields: true,
      supportsFullTextSearch: true,
    };
  }

  estimateSize(recordCount: number): number {
    // Rough estimate: 1KB per record average
    return recordCount * 1024;
  }
}
