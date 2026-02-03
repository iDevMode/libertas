import { Platform, EntityType, PropertyType } from '../common/types.js';

// OAuth credentials for authentication
export interface OAuthCredentials {
  code: string;
  redirectUri: string;
  state?: string;
}

// Token returned after authentication
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope?: string;
  workspaceId?: string;
  workspaceName?: string;
}

// Rate limit configuration
export interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize?: number;
  dailyLimit?: number;
}

// Connector capabilities
export interface ConnectorCapabilities {
  supportsIncrementalSync: boolean;
  supportsRelations: boolean;
  supportsAttachments: boolean;
  supportsComments: boolean;
  supportsRichText: boolean;
  supportsFullExport: boolean;
  maxPageSize: number;
}

// Source schema discovered from platform
export interface SourceSchema {
  databases: DatabaseSchema[];
  pages?: number;
  totalRecords?: number;
  estimatedSize?: number;
}

export interface DatabaseSchema {
  id: string;
  title: string;
  properties: PropertySchema[];
  estimatedRecords?: number;
}

export interface PropertySchema {
  id: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[];
}

export interface SelectOption {
  id: string;
  name: string;
  color?: string;
}

// Entity list for discovery
export interface EntityListItem {
  id: string;
  type: EntityType;
  title: string;
  parentId?: string;
  updatedAt?: Date;
  recordCount?: number;
}

export interface EntityList {
  items: EntityListItem[];
  hasMore: boolean;
  nextCursor?: string;
}

// Filter for listing entities
export interface EntityFilter {
  parentId?: string;
  types?: EntityType[];
  updatedAfter?: Date;
  cursor?: string;
  pageSize?: number;
}

// Raw entity from platform API
export interface RawEntity {
  id: string;
  type: string;
  rawData: unknown;
  extractedAt: Date;
}

/**
 * Interface that all platform connectors must implement
 */
export interface IConnector {
  // Metadata
  readonly name: string;
  readonly platform: Platform;
  readonly version: string;
  readonly tier: 'community' | 'pro' | 'enterprise';

  // Authentication
  getAuthorizationUrl(state: string): string;
  authenticate(credentials: OAuthCredentials): Promise<AuthToken>;
  refreshToken(token: AuthToken): Promise<AuthToken>;
  revokeToken(token: AuthToken): Promise<void>;

  // Discovery
  discoverSchema(token: AuthToken): Promise<SourceSchema>;
  listEntities(token: AuthToken, filter?: EntityFilter): Promise<EntityList>;

  // Extraction
  extractEntity(token: AuthToken, id: string): Promise<RawEntity>;
  extractBatch(token: AuthToken, ids: string[]): AsyncGenerator<RawEntity, void, unknown>;

  // Metadata
  getRateLimits(): RateLimitConfig;
  getCapabilities(): ConnectorCapabilities;
}

/**
 * Base class for connectors with common functionality
 */
export abstract class BaseConnector implements IConnector {
  abstract readonly name: string;
  abstract readonly platform: Platform;
  abstract readonly version: string;
  abstract readonly tier: 'community' | 'pro' | 'enterprise';

  abstract getAuthorizationUrl(state: string): string;
  abstract authenticate(credentials: OAuthCredentials): Promise<AuthToken>;
  abstract refreshToken(token: AuthToken): Promise<AuthToken>;
  abstract revokeToken(token: AuthToken): Promise<void>;
  abstract discoverSchema(token: AuthToken): Promise<SourceSchema>;
  abstract listEntities(token: AuthToken, filter?: EntityFilter): Promise<EntityList>;
  abstract extractEntity(token: AuthToken, id: string): Promise<RawEntity>;
  abstract getRateLimits(): RateLimitConfig;
  abstract getCapabilities(): ConnectorCapabilities;

  async *extractBatch(
    token: AuthToken,
    ids: string[]
  ): AsyncGenerator<RawEntity, void, unknown> {
    const rateLimits = this.getRateLimits();
    const delayMs = 1000 / rateLimits.requestsPerSecond;

    for (const id of ids) {
      yield await this.extractEntity(token, id);
      await this.delay(delayMs);
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
