import {
  NormalizedEntity,
  NormalizedProperty,
  NormalizedRelation,
  NormalizedContentBlock,
  NormalizedAttachment,
} from '../transformers/interfaces.js';

// Connection configuration for different destinations
export interface SQLiteConfig {
  type: 'sqlite';
  filepath: string;
}

export interface PostgreSQLConfig {
  type: 'postgresql';
  connectionString: string;
}

export interface JSONConfig {
  type: 'json';
  outputDir: string;
  prettyPrint?: boolean;
}

export interface CSVConfig {
  type: 'csv';
  outputDir: string;
  delimiter?: string;
}

export interface MarkdownConfig {
  type: 'markdown';
  outputDir: string;
  includeMetadata?: boolean;
  includeFrontmatter?: boolean;
}

export type DestinationConfig = SQLiteConfig | PostgreSQLConfig | JSONConfig | CSVConfig | MarkdownConfig;

// Write result
export interface WriteResult {
  inserted: number;
  updated: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

// Adapter capabilities
export interface AdapterCapabilities {
  supportsTransactions: boolean;
  supportsRelations: boolean;
  supportsBulkInsert: boolean;
  maxBatchSize: number;
  supportsJSONFields: boolean;
  supportsFullTextSearch: boolean;
}

// Transaction handle
export interface Transaction {
  id: string;
  startedAt: Date;
}

/**
 * Interface that all destination adapters must implement
 */
export interface IDestinationAdapter {
  // Connection management
  connect(config: DestinationConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;

  // Schema operations
  createSchema(): Promise<void>;
  getExistingSchema(): Promise<boolean>;

  // Transaction management
  beginTransaction(): Promise<Transaction>;
  commit(transaction: Transaction): Promise<void>;
  rollback(transaction: Transaction): Promise<void>;

  // Write operations
  writeEntities(entities: NormalizedEntity[]): Promise<WriteResult>;
  writeProperties(properties: NormalizedProperty[]): Promise<WriteResult>;
  writeRelations(relations: NormalizedRelation[]): Promise<WriteResult>;
  writeContentBlocks(blocks: NormalizedContentBlock[]): Promise<WriteResult>;
  writeAttachments(attachments: NormalizedAttachment[]): Promise<WriteResult>;

  // Utility
  getCapabilities(): AdapterCapabilities;
  estimateSize(recordCount: number): number;
}
