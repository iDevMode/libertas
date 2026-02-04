import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  IDestinationAdapter,
  JSONConfig,
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

interface ExportData {
  entities: NormalizedEntity[];
  properties: NormalizedProperty[];
  relations: NormalizedRelation[];
  contentBlocks: NormalizedContentBlock[];
  attachments: NormalizedAttachment[];
  exportedAt: string;
  version: string;
}

export class JSONAdapter implements IDestinationAdapter {
  private config: JSONConfig | null = null;
  private data: ExportData | null = null;
  private inTransaction = false;

  async connect(config: DestinationConfig): Promise<void> {
    if (config.type !== 'json') {
      throw new Error('Invalid config type for JSONAdapter');
    }

    this.config = config;
    await mkdir(config.outputDir, { recursive: true });

    logger.info({ outputDir: config.outputDir }, 'JSON adapter initialized');
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.data = null;
    logger.info('JSON adapter disconnected');
  }

  async testConnection(): Promise<boolean> {
    return this.config !== null;
  }

  async createSchema(): Promise<void> {
    // JSON doesn't need schema creation
    this.data = {
      entities: [],
      properties: [],
      relations: [],
      contentBlocks: [],
      attachments: [],
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    logger.info('JSON export structure initialized');
  }

  async getExistingSchema(): Promise<boolean> {
    return false; // Always create fresh export
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

    // Update export timestamp
    this.data.exportedAt = new Date().toISOString();

    // Serialize dates for JSON
    const serializedData = this.serializeForJSON(this.data);

    // Write to file
    const outputPath = join(this.config.outputDir, 'export.json');
    const jsonContent = this.config.prettyPrint
      ? JSON.stringify(serializedData, null, 2)
      : JSON.stringify(serializedData);

    await writeFile(outputPath, jsonContent, 'utf-8');

    this.inTransaction = false;
    logger.info({ outputPath, entityCount: this.data.entities.length }, 'JSON export committed');
  }

  async rollback(_transaction: Transaction): Promise<void> {
    if (this.data) {
      this.data = {
        entities: [],
        properties: [],
        relations: [],
        contentBlocks: [],
        attachments: [],
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
      };
    }
    this.inTransaction = false;
    logger.info('JSON export rolled back');
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
      supportsRelations: true,
      supportsBulkInsert: true,
      maxBatchSize: 10000,
      supportsJSONFields: true,
      supportsFullTextSearch: false,
    };
  }

  estimateSize(recordCount: number): number {
    // Rough estimate: 2KB per record for JSON
    return recordCount * 2048;
  }

  private serializeForJSON(data: ExportData): Record<string, unknown> {
    return {
      ...data,
      entities: data.entities.map((e) => ({
        ...e,
        createdAt: e.createdAt?.toISOString(),
        updatedAt: e.updatedAt?.toISOString(),
      })),
      properties: data.properties.map((p) => ({
        ...p,
        valueDate: p.valueDate?.toISOString(),
      })),
      attachments: data.attachments.map((a) => ({
        ...a,
        downloadedAt: a.downloadedAt?.toISOString(),
      })),
    };
  }

  getOutputPath(): string {
    if (!this.config) throw new Error('Adapter not connected');
    return join(this.config.outputDir, 'export.json');
  }
}
