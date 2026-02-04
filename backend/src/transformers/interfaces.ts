import { EntityType, PropertyType, RelationType, BlockType, Platform } from '../common/types.js';
import { RawEntity } from '../connectors/interfaces.js';

// Normalized entity structure
export interface NormalizedEntity {
  id: string;
  entityType: EntityType;
  title: string;
  createdAt?: Date;
  updatedAt?: Date;
  parentId?: string;
  sourcePlatform: Platform;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

// Normalized property (EAV pattern)
export interface NormalizedProperty {
  id: string;
  entityId: string;
  propertyName: string;
  propertyType: PropertyType;
  valueText?: string;
  valueNumber?: number;
  valueDate?: Date;
  valueBoolean?: boolean;
  valueJson?: unknown;
  position: number;
}

// Normalized relation between entities
export interface NormalizedRelation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: RelationType;
  metadata?: Record<string, unknown>;
}

// Normalized content block (for rich text)
export interface NormalizedContentBlock {
  id: string;
  entityId: string;
  blockType: BlockType;
  content?: string;
  position: number;
  parentBlockId?: string;
  metadata?: Record<string, unknown>;
}

// Normalized attachment
export interface NormalizedAttachment {
  id: string;
  entityId: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  sourceUrl?: string;
  localPath?: string;
  downloadedAt?: Date;
  metadata?: Record<string, unknown>;
}

// Complete normalized result from transformation
export interface NormalizedResult {
  entity: NormalizedEntity;
  properties: NormalizedProperty[];
  relations: NormalizedRelation[];
  contentBlocks: NormalizedContentBlock[];
  attachments: NormalizedAttachment[];
}

/**
 * Interface that all normalizers must implement
 */
export interface INormalizer {
  normalizeEntity(raw: RawEntity): NormalizedEntity;
  normalizeProperties(raw: RawEntity): NormalizedProperty[];
  normalizeRelations(raw: RawEntity): NormalizedRelation[];
  normalizeContentBlocks(raw: RawEntity): NormalizedContentBlock[];
}

/**
 * Universal normalizer that delegates to platform-specific normalizers
 */
export interface IUniversalNormalizer {
  normalize(raw: RawEntity, platform: Platform): NormalizedResult;
}

// Database schema types for relational export (Pro feature)
export interface RelationalDatabaseSchema {
  id: string;
  name: string;
  tableName: string;  // Sanitized for SQL (e.g., "My Tasks" -> "my_tasks")
  properties: RelationalPropertySchema[];
}

export interface RelationalPropertySchema {
  id: string;
  name: string;
  columnName: string;  // Sanitized for SQL
  type: PropertyType;
  relationTargetDatabaseId?: string;  // For relation properties, the target database ID
}
