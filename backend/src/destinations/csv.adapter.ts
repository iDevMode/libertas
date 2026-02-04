import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  IDestinationAdapter,
  CSVConfig,
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

interface CSVData {
  entities: NormalizedEntity[];
  properties: NormalizedProperty[];
  relations: NormalizedRelation[];
  contentBlocks: NormalizedContentBlock[];
  attachments: NormalizedAttachment[];
}

export class CSVAdapter implements IDestinationAdapter {
  private config: CSVConfig | null = null;
  private data: CSVData | null = null;
  private inTransaction = false;

  async connect(config: DestinationConfig): Promise<void> {
    if (config.type !== 'csv') {
      throw new Error('Invalid config type for CSVAdapter');
    }

    this.config = config;
    await mkdir(config.outputDir, { recursive: true });

    logger.info({ outputDir: config.outputDir }, 'CSV adapter initialized');
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.data = null;
    logger.info('CSV adapter disconnected');
  }

  async testConnection(): Promise<boolean> {
    return this.config !== null;
  }

  async createSchema(): Promise<void> {
    this.data = {
      entities: [],
      properties: [],
      relations: [],
      contentBlocks: [],
      attachments: [],
    };
    logger.info('CSV export structure initialized');
  }

  async getExistingSchema(): Promise<boolean> {
    return false;
  }

  async beginTransaction(): Promise<Transaction> {
    const transaction: Transaction = {
      id: uuidv4(),
      startedAt: new Date(),
    };

    this.inTransaction = true;
    return transaction;
  }

  async commit(_transaction: Transaction): Promise<void> {
    if (!this.config || !this.data) {
      throw new Error('Adapter not connected');
    }

    const delimiter = this.config.delimiter || ',';

    // Write entities CSV
    if (this.data.entities.length > 0) {
      const entitiesCSV = this.entitiesToCSV(this.data.entities, delimiter);
      await writeFile(join(this.config.outputDir, 'entities.csv'), entitiesCSV, 'utf-8');
    }

    // Write properties CSV
    if (this.data.properties.length > 0) {
      const propertiesCSV = this.propertiesToCSV(this.data.properties, delimiter);
      await writeFile(join(this.config.outputDir, 'properties.csv'), propertiesCSV, 'utf-8');
    }

    // Write relations CSV
    if (this.data.relations.length > 0) {
      const relationsCSV = this.relationsToCSV(this.data.relations, delimiter);
      await writeFile(join(this.config.outputDir, 'relations.csv'), relationsCSV, 'utf-8');
    }

    // Write content blocks CSV
    if (this.data.contentBlocks.length > 0) {
      const blocksCSV = this.contentBlocksToCSV(this.data.contentBlocks, delimiter);
      await writeFile(join(this.config.outputDir, 'content_blocks.csv'), blocksCSV, 'utf-8');
    }

    // Write attachments CSV
    if (this.data.attachments.length > 0) {
      const attachmentsCSV = this.attachmentsToCSV(this.data.attachments, delimiter);
      await writeFile(join(this.config.outputDir, 'attachments.csv'), attachmentsCSV, 'utf-8');
    }

    this.inTransaction = false;
    logger.info({ outputDir: this.config.outputDir, entityCount: this.data.entities.length }, 'CSV export committed');
  }

  async rollback(_transaction: Transaction): Promise<void> {
    if (this.data) {
      this.data = {
        entities: [],
        properties: [],
        relations: [],
        contentBlocks: [],
        attachments: [],
      };
    }
    this.inTransaction = false;
    logger.info('CSV export rolled back');
  }

  async writeEntities(entities: NormalizedEntity[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    this.data.entities.push(...entities);
    return { inserted: entities.length, updated: 0, failed: 0 };
  }

  async writeProperties(properties: NormalizedProperty[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    this.data.properties.push(...properties);
    return { inserted: properties.length, updated: 0, failed: 0 };
  }

  async writeRelations(relations: NormalizedRelation[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    this.data.relations.push(...relations);
    return { inserted: relations.length, updated: 0, failed: 0 };
  }

  async writeContentBlocks(blocks: NormalizedContentBlock[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    this.data.contentBlocks.push(...blocks);
    return { inserted: blocks.length, updated: 0, failed: 0 };
  }

  async writeAttachments(attachments: NormalizedAttachment[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    this.data.attachments.push(...attachments);
    return { inserted: attachments.length, updated: 0, failed: 0 };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsTransactions: true,
      supportsRelations: false, // CSV doesn't maintain FK relationships well
      supportsBulkInsert: true,
      maxBatchSize: 10000,
      supportsJSONFields: false,
      supportsFullTextSearch: false,
    };
  }

  estimateSize(recordCount: number): number {
    // Rough estimate: 500 bytes per record for CSV
    return recordCount * 500;
  }

  private escapeCSV(value: string | null | undefined, delimiter: string): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape if contains delimiter, quotes, or newlines
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private entitiesToCSV(entities: NormalizedEntity[], delimiter: string): string {
    const headers = ['id', 'entity_type', 'title', 'created_at', 'updated_at', 'parent_id', 'source_platform', 'source_url', 'metadata'];
    const rows = entities.map((e) => [
      this.escapeCSV(e.id, delimiter),
      this.escapeCSV(e.entityType, delimiter),
      this.escapeCSV(e.title, delimiter),
      this.escapeCSV(e.createdAt?.toISOString(), delimiter),
      this.escapeCSV(e.updatedAt?.toISOString(), delimiter),
      this.escapeCSV(e.parentId, delimiter),
      this.escapeCSV(e.sourcePlatform, delimiter),
      this.escapeCSV(e.sourceUrl, delimiter),
      this.escapeCSV(e.metadata ? JSON.stringify(e.metadata) : null, delimiter),
    ].join(delimiter));

    return [headers.join(delimiter), ...rows].join('\n');
  }

  private propertiesToCSV(properties: NormalizedProperty[], delimiter: string): string {
    const headers = ['id', 'entity_id', 'property_name', 'property_type', 'value_text', 'value_number', 'value_date', 'value_boolean', 'value_json', 'position'];
    const rows = properties.map((p) => [
      this.escapeCSV(p.id, delimiter),
      this.escapeCSV(p.entityId, delimiter),
      this.escapeCSV(p.propertyName, delimiter),
      this.escapeCSV(p.propertyType, delimiter),
      this.escapeCSV(p.valueText, delimiter),
      this.escapeCSV(p.valueNumber?.toString(), delimiter),
      this.escapeCSV(p.valueDate?.toISOString(), delimiter),
      this.escapeCSV(p.valueBoolean?.toString(), delimiter),
      this.escapeCSV(p.valueJson ? JSON.stringify(p.valueJson) : null, delimiter),
      this.escapeCSV(p.position?.toString(), delimiter),
    ].join(delimiter));

    return [headers.join(delimiter), ...rows].join('\n');
  }

  private relationsToCSV(relations: NormalizedRelation[], delimiter: string): string {
    const headers = ['id', 'from_entity_id', 'to_entity_id', 'relation_type', 'metadata'];
    const rows = relations.map((r) => [
      this.escapeCSV(r.id, delimiter),
      this.escapeCSV(r.fromEntityId, delimiter),
      this.escapeCSV(r.toEntityId, delimiter),
      this.escapeCSV(r.relationType, delimiter),
      this.escapeCSV(r.metadata ? JSON.stringify(r.metadata) : null, delimiter),
    ].join(delimiter));

    return [headers.join(delimiter), ...rows].join('\n');
  }

  private contentBlocksToCSV(blocks: NormalizedContentBlock[], delimiter: string): string {
    const headers = ['id', 'entity_id', 'block_type', 'content', 'position', 'parent_block_id', 'metadata'];
    const rows = blocks.map((b) => [
      this.escapeCSV(b.id, delimiter),
      this.escapeCSV(b.entityId, delimiter),
      this.escapeCSV(b.blockType, delimiter),
      this.escapeCSV(b.content, delimiter),
      this.escapeCSV(b.position?.toString(), delimiter),
      this.escapeCSV(b.parentBlockId, delimiter),
      this.escapeCSV(b.metadata ? JSON.stringify(b.metadata) : null, delimiter),
    ].join(delimiter));

    return [headers.join(delimiter), ...rows].join('\n');
  }

  private attachmentsToCSV(attachments: NormalizedAttachment[], delimiter: string): string {
    const headers = ['id', 'entity_id', 'file_name', 'file_type', 'file_size', 'source_url', 'local_path', 'downloaded_at', 'metadata'];
    const rows = attachments.map((a) => [
      this.escapeCSV(a.id, delimiter),
      this.escapeCSV(a.entityId, delimiter),
      this.escapeCSV(a.fileName, delimiter),
      this.escapeCSV(a.fileType, delimiter),
      this.escapeCSV(a.fileSize?.toString(), delimiter),
      this.escapeCSV(a.sourceUrl, delimiter),
      this.escapeCSV(a.localPath, delimiter),
      this.escapeCSV(a.downloadedAt?.toISOString(), delimiter),
      this.escapeCSV(a.metadata ? JSON.stringify(a.metadata) : null, delimiter),
    ].join(delimiter));

    return [headers.join(delimiter), ...rows].join('\n');
  }

  getOutputPath(): string {
    if (!this.config) throw new Error('Adapter not connected');
    return this.config.outputDir;
  }
}
