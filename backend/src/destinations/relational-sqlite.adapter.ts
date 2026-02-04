import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  IDestinationAdapter,
  RelationalSQLiteConfig,
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
  RelationalDatabaseSchema,
} from '../transformers/interfaces.js';
import { logger } from '../common/logger.js';
import { PropertyType } from '../common/types.js';

// SQL reserved words to avoid as table/column names
const SQL_RESERVED_WORDS = new Set([
  'abort', 'action', 'add', 'after', 'all', 'alter', 'analyze', 'and', 'as',
  'asc', 'attach', 'autoincrement', 'before', 'begin', 'between', 'by',
  'cascade', 'case', 'cast', 'check', 'collate', 'column', 'commit',
  'conflict', 'constraint', 'create', 'cross', 'current', 'current_date',
  'current_time', 'current_timestamp', 'database', 'default', 'deferrable',
  'deferred', 'delete', 'desc', 'detach', 'distinct', 'do', 'drop', 'each',
  'else', 'end', 'escape', 'except', 'exclusive', 'exists', 'explain',
  'fail', 'filter', 'first', 'following', 'for', 'foreign', 'from', 'full',
  'glob', 'group', 'having', 'if', 'ignore', 'immediate', 'in', 'index',
  'indexed', 'initially', 'inner', 'insert', 'instead', 'intersect', 'into',
  'is', 'isnull', 'join', 'key', 'last', 'left', 'like', 'limit', 'match',
  'natural', 'no', 'not', 'nothing', 'notnull', 'null', 'nulls', 'of',
  'offset', 'on', 'or', 'order', 'others', 'outer', 'over', 'partition',
  'plan', 'pragma', 'preceding', 'primary', 'query', 'raise', 'range',
  'recursive', 'references', 'regexp', 'reindex', 'release', 'rename',
  'replace', 'restrict', 'right', 'rollback', 'row', 'rows', 'savepoint',
  'select', 'set', 'table', 'temp', 'temporary', 'then', 'ties', 'to',
  'transaction', 'trigger', 'unbounded', 'union', 'unique', 'update',
  'using', 'vacuum', 'values', 'view', 'virtual', 'when', 'where', 'window',
  'with', 'without',
]);

/**
 * Relational SQLite Adapter (Pro Feature)
 *
 * Creates database-specific tables with typed columns and proper foreign keys,
 * making it easy to import Notion data into other relational tools.
 */
export class RelationalSQLiteAdapter implements IDestinationAdapter {
  private db: Database.Database | null = null;
  private config: RelationalSQLiteConfig | null = null;
  private databaseSchemas: Map<string, RelationalDatabaseSchema> = new Map();
  private entityToDatabaseMap: Map<string, string> = new Map();

  /**
   * Set the database schemas for relational table creation.
   * This must be called before createSchema() to enable relational mode.
   */
  setDatabaseSchemas(schemas: RelationalDatabaseSchema[]): void {
    this.databaseSchemas.clear();
    for (const schema of schemas) {
      this.databaseSchemas.set(schema.id, schema);
    }
    logger.info({ count: schemas.length }, 'Database schemas set for relational export');
  }

  async connect(config: DestinationConfig): Promise<void> {
    if (config.type !== 'relational_sqlite') {
      throw new Error('Invalid config type for RelationalSQLiteAdapter');
    }

    this.config = config;
    this.db = new Database(config.filepath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    logger.info({ filepath: config.filepath }, 'Relational SQLite database connected');
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Relational SQLite database disconnected');
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

    // Create metadata table to track source information
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _export_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Store export timestamp
    const metaStmt = this.db.prepare(
      'INSERT OR REPLACE INTO _export_metadata (key, value) VALUES (?, ?)'
    );
    metaStmt.run('exported_at', new Date().toISOString());
    metaStmt.run('export_type', 'relational_sqlite');

    // Create database-specific tables
    for (const [_dbId, schema] of this.databaseSchemas) {
      this.createDatabaseTable(schema);
    }

    // Create a fallback table for entities that don't belong to a known database
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _other_entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        parent_id TEXT,
        source_platform TEXT NOT NULL,
        source_url TEXT,
        metadata TEXT
      );
    `);

    // Create content blocks table (shared across all entities)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _content_blocks (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        block_type TEXT NOT NULL,
        content TEXT,
        position INTEGER NOT NULL,
        parent_block_id TEXT,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_content_blocks_entity ON _content_blocks(entity_id);
    `);

    // Create attachments table (shared across all entities)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _attachments (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        source_url TEXT,
        local_path TEXT,
        downloaded_at TEXT,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_attachments_entity ON _attachments(entity_id);
    `);

    logger.info({ tableCount: this.databaseSchemas.size }, 'Relational schema created');
  }

  private createDatabaseTable(schema: RelationalDatabaseSchema): void {
    if (!this.db) throw new Error('Database not connected');

    const columns: string[] = [
      'id TEXT PRIMARY KEY',
      'title TEXT',
      'created_at TEXT',
      'updated_at TEXT',
      'source_url TEXT',
    ];

    const foreignKeys: string[] = [];

    // Add columns for each property
    for (const prop of schema.properties) {
      const sqlType = this.mapPropertyTypeToSQLite(prop.type);
      columns.push(`${prop.columnName} ${sqlType}`);

      // Add foreign key for relation properties
      if (prop.type === 'relation' && prop.relationTargetDatabaseId) {
        const targetSchema = this.databaseSchemas.get(prop.relationTargetDatabaseId);
        if (targetSchema) {
          foreignKeys.push(
            `FOREIGN KEY (${prop.columnName}) REFERENCES ${targetSchema.tableName}(id)`
          );
        }
      }
    }

    // Build CREATE TABLE statement
    const allConstraints = [...columns, ...foreignKeys];
    const createSQL = `
      CREATE TABLE IF NOT EXISTS ${schema.tableName} (
        ${allConstraints.join(',\n        ')}
      );
    `;

    try {
      this.db.exec(createSQL);
      logger.debug({ tableName: schema.tableName }, 'Created relational table');
    } catch (error) {
      logger.error({ tableName: schema.tableName, error: (error as Error).message }, 'Failed to create table');
      throw error;
    }

    // Create indexes on foreign key columns
    for (const prop of schema.properties) {
      if (prop.type === 'relation') {
        try {
          this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_${schema.tableName}_${prop.columnName}
            ON ${schema.tableName}(${prop.columnName});
          `);
        } catch {
          // Index creation might fail if column doesn't exist, ignore
        }
      }
    }
  }

  private mapPropertyTypeToSQLite(type: PropertyType): string {
    switch (type) {
      case 'number':
        return 'REAL';
      case 'boolean':
        return 'INTEGER';  // SQLite uses 0/1 for booleans
      case 'date':
        return 'TEXT';     // ISO format string
      case 'text':
      case 'select':
      case 'url':
      case 'email':
      case 'phone':
      case 'formula':
      case 'rollup':
        return 'TEXT';
      case 'multi_select':
      case 'relation':
      case 'file':
        return 'TEXT';     // JSON array or single ID for relation
      default:
        return 'TEXT';
    }
  }

  async getExistingSchema(): Promise<boolean> {
    if (!this.db) throw new Error('Database not connected');

    const result = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_export_metadata'")
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

    let inserted = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const entity of entities) {
      try {
        // Determine which database this entity belongs to based on parent
        const parentId = entity.parentId;
        let targetTable = '_other_entities';

        if (parentId && this.databaseSchemas.has(parentId)) {
          const schema = this.databaseSchemas.get(parentId)!;
          targetTable = schema.tableName;
          // Track which database this entity belongs to for property writing
          this.entityToDatabaseMap.set(entity.id, parentId);
        }

        if (targetTable === '_other_entities') {
          // Insert into fallback table
          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO _other_entities
            (id, entity_type, title, created_at, updated_at, parent_id, source_platform, source_url, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            entity.id,
            entity.entityType,
            entity.title,
            entity.createdAt?.toISOString(),
            entity.updatedAt?.toISOString(),
            entity.parentId,
            entity.sourcePlatform,
            entity.sourceUrl,
            entity.metadata ? JSON.stringify(entity.metadata) : null
          );
        } else {
          // Insert into database-specific table with just base columns
          // Properties will be added in writeProperties
          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO ${targetTable}
            (id, title, created_at, updated_at, source_url)
            VALUES (?, ?, ?, ?, ?)
          `);
          stmt.run(
            entity.id,
            entity.title,
            entity.createdAt?.toISOString(),
            entity.updatedAt?.toISOString(),
            entity.sourceUrl
          );
        }

        inserted++;
      } catch (err) {
        failed++;
        errors.push({ id: entity.id, error: (err as Error).message });
        logger.warn({ entityId: entity.id, error: (err as Error).message }, 'Failed to write entity');
      }
    }

    return { inserted, updated: 0, failed, errors: errors.length > 0 ? errors : undefined };
  }

  async writeProperties(properties: NormalizedProperty[]): Promise<WriteResult> {
    if (!this.db) throw new Error('Database not connected');

    let inserted = 0;

    // Group properties by entity
    const propertiesByEntity = new Map<string, NormalizedProperty[]>();
    for (const prop of properties) {
      const existing = propertiesByEntity.get(prop.entityId) || [];
      existing.push(prop);
      propertiesByEntity.set(prop.entityId, existing);
    }

    // Update each entity's row with its properties
    for (const [entityId, entityProps] of propertiesByEntity) {
      const databaseId = this.entityToDatabaseMap.get(entityId);
      if (!databaseId) {
        // Entity not in a known database, skip property update
        continue;
      }

      const schema = this.databaseSchemas.get(databaseId);
      if (!schema) continue;

      // Build UPDATE statement for this entity's properties
      const updates: string[] = [];
      const values: (string | number | null)[] = [];

      for (const prop of entityProps) {
        // Find matching column in schema
        const propSchema = schema.properties.find(
          p => p.name === prop.propertyName || p.id === prop.propertyName
        );
        if (!propSchema) continue;

        updates.push(`${propSchema.columnName} = ?`);

        // Get appropriate value based on property type
        let value: string | number | null = null;
        switch (prop.propertyType) {
          case 'number':
            value = prop.valueNumber ?? null;
            break;
          case 'boolean':
            value = prop.valueBoolean !== undefined ? (prop.valueBoolean ? 1 : 0) : null;
            break;
          case 'date':
            value = prop.valueDate?.toISOString() ?? prop.valueText ?? null;
            break;
          case 'relation':
            // For relations, extract the first ID from valueJson array
            if (prop.valueJson && Array.isArray(prop.valueJson)) {
              value = (prop.valueJson as string[])[0] ?? null;
            } else {
              value = prop.valueText ?? null;
            }
            break;
          case 'multi_select':
          case 'file':
            // Store as JSON array
            value = prop.valueJson ? JSON.stringify(prop.valueJson) : prop.valueText ?? null;
            break;
          default:
            value = prop.valueText ?? null;
        }

        values.push(value);
        inserted++;
      }

      if (updates.length > 0) {
        values.push(entityId);
        const sql = `UPDATE ${schema.tableName} SET ${updates.join(', ')} WHERE id = ?`;
        try {
          this.db.prepare(sql).run(...values);
        } catch (err) {
          logger.warn({ entityId, error: (err as Error).message }, 'Failed to update properties');
        }
      }
    }

    return { inserted, updated: 0, failed: 0 };
  }

  async writeRelations(relations: NormalizedRelation[]): Promise<WriteResult> {
    // Relations are handled via foreign key columns in writeProperties
    // We don't need a separate relations table in relational mode
    return { inserted: relations.length, updated: 0, failed: 0 };
  }

  async writeContentBlocks(blocks: NormalizedContentBlock[]): Promise<WriteResult> {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO _content_blocks
      (id, entity_id, block_type, content, position, parent_block_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;

    for (const block of blocks) {
      stmt.run(
        block.id,
        block.entityId,
        block.blockType,
        block.content,
        block.position,
        block.parentBlockId,
        block.metadata ? JSON.stringify(block.metadata) : null
      );
      inserted++;
    }

    return { inserted, updated: 0, failed: 0 };
  }

  async writeAttachments(attachments: NormalizedAttachment[]): Promise<WriteResult> {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO _attachments
      (id, entity_id, file_name, file_type, file_size, source_url, local_path, downloaded_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;

    for (const att of attachments) {
      stmt.run(
        att.id,
        att.entityId,
        att.fileName,
        att.fileType,
        att.fileSize,
        att.sourceUrl,
        att.localPath,
        att.downloadedAt?.toISOString(),
        att.metadata ? JSON.stringify(att.metadata) : null
      );
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
      supportsFullTextSearch: false,  // No FTS in relational mode
    };
  }

  estimateSize(recordCount: number): number {
    // Rough estimate: 1.2KB per record (slightly more than universal due to wider tables)
    return recordCount * 1228;
  }
}

/**
 * Sanitize a string to be a valid SQL identifier.
 * - Converts to lowercase
 * - Replaces spaces and special characters with underscores
 * - Removes leading/trailing underscores
 * - Prefixes with underscore if starts with number
 * - Adds suffix if reserved word
 */
export function sanitizeSQLIdentifier(name: string): string {
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')  // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_')          // Collapse multiple underscores
    .replace(/^_+|_+$/g, '');     // Trim leading/trailing underscores

  // If empty, use a default
  if (!sanitized) {
    sanitized = 'unnamed';
  }

  // If starts with number, prefix with underscore
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  // If reserved word, add suffix
  if (SQL_RESERVED_WORDS.has(sanitized)) {
    sanitized = sanitized + '_col';
  }

  return sanitized;
}

/**
 * Convert a SourceSchema database to a RelationalDatabaseSchema
 */
export function convertToRelationalSchema(
  id: string,
  title: string,
  properties: Array<{
    id: string;
    name: string;
    type: PropertyType;
    relationTargetDatabaseId?: string;
  }>
): RelationalDatabaseSchema {
  return {
    id,
    name: title,
    tableName: sanitizeSQLIdentifier(title),
    properties: properties.map(prop => ({
      id: prop.id,
      name: prop.name,
      columnName: sanitizeSQLIdentifier(prop.name),
      type: prop.type,
      relationTargetDatabaseId: prop.relationTargetDatabaseId,
    })),
  };
}
