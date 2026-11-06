import {
  BaseConnector,
  OAuthCredentials,
  AuthToken,
  SourceSchema,
  EntityList,
  EntityFilter,
  RawEntity,
  RateLimitConfig,
  ConnectorCapabilities,
  PropertySchema,
} from '../interfaces.js';
import { config } from '../../common/config.js';
import { logger } from '../../common/logger.js';
import { mapAirtableFieldType } from './airtable.field-types.js';
import {
  AirtableBase,
  AirtableErrorResponse,
  AirtableFieldSchema,
  AirtableListBasesResponse,
  AirtableListRecordsResponse,
  AirtableListTablesResponse,
  AirtableRecord,
  AirtableTableExtract,
  AirtableTableSchema,
  AirtableTokenResponse,
} from './airtable.types.js';

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const AIRTABLE_OAUTH_BASE = 'https://airtable.com/oauth2/v1';
/** Airtable asks clients to wait 30 seconds after a 429 before retrying. */
const RATE_LIMIT_WAIT_MS = 30_000;
const MAX_RATE_LIMIT_RETRIES = 3;

export class AirtableConnector extends BaseConnector {
  readonly name = 'airtable';
  readonly platform = 'airtable' as const;
  readonly version = '1.1.0';
  readonly tier = 'community' as const;

  /** Overridable in tests so rate-limit retries don't actually wait. */
  protected rateLimitWaitMs = RATE_LIMIT_WAIT_MS;

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.airtableClientId || '',
      redirect_uri: config.airtableRedirectUri || '',
      response_type: 'code',
      state,
      scope: 'data.records:read data.recordComments:read schema.bases:read',
    });

    return `${AIRTABLE_OAUTH_BASE}/authorize?${params.toString()}`;
  }

  async authenticate(credentials: OAuthCredentials): Promise<AuthToken> {
    const response = await this.requestToken({
      grant_type: 'authorization_code',
      code: credentials.code,
      redirect_uri: credentials.redirectUri,
      code_verifier: credentials.state || '',
    });

    if (!response.ok) {
      const error = (await response.json()) as AirtableErrorResponse;
      logger.error({ error }, 'Airtable OAuth failed');
      throw new Error(`Airtable authentication failed: ${describeError(error)}`);
    }

    return toAuthToken((await response.json()) as AirtableTokenResponse);
  }

  async refreshToken(token: AuthToken): Promise<AuthToken> {
    if (!token.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Airtable token');
    }

    return toAuthToken((await response.json()) as AirtableTokenResponse);
  }

  async revokeToken(_token: AuthToken): Promise<void> {
    // Airtable doesn't have a token revocation endpoint
    logger.info('Airtable tokens must be revoked through Airtable settings');
  }

  async discoverSchema(token: AuthToken): Promise<SourceSchema> {
    const bases = await this.listBases(token);
    const databases: SourceSchema['databases'] = [];

    for (const base of bases) {
      const tables = await this.listTables(token, base.id);
      for (const table of tables) {
        databases.push({
          id: `${base.id}/${table.id}`,
          title: `${base.name} / ${table.name}`,
          properties: table.fields.map((field) => toPropertySchema(base.id, field)),
        });
      }
    }

    return { databases };
  }

  async listEntities(token: AuthToken, filter?: EntityFilter): Promise<EntityList> {
    const bases = await this.listBases(token);
    const items = bases.map((base) => ({
      id: base.id,
      type: 'database' as const,
      title: base.name,
    }));

    return {
      items: items.slice(0, filter?.pageSize || 100),
      hasMore: false,
    };
  }

  /**
   * Extracts one table, identified as "baseId/tableId", with its field schema.
   * Records are keyed by field ID so renamed fields still map correctly.
   */
  async extractEntity(token: AuthToken, id: string): Promise<RawEntity> {
    const [baseId, tableId] = id.split('/');
    if (!baseId || !tableId) {
      throw new Error(`Airtable entity ID must be "baseId/tableId", got "${id}"`);
    }

    const table = await this.findTableSchema(token, baseId, tableId);
    const records = await this.listRecords(token, baseId, tableId);
    const rawData: AirtableTableExtract = { baseId, tableId, table, records };

    return { id, type: 'table', rawData, extractedAt: new Date() };
  }

  getRateLimits(): RateLimitConfig {
    return {
      requestsPerSecond: 5,
      burstSize: 10,
    };
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsIncrementalSync: false,
      supportsRelations: true,
      supportsAttachments: true,
      supportsComments: true,
      supportsRichText: false,
      supportsFullExport: true,
      maxPageSize: 100,
    };
  }

  private async listBases(token: AuthToken): Promise<AirtableBase[]> {
    const bases: AirtableBase[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams();
      if (offset) params.set('offset', offset);
      const data = await this.getJson<AirtableListBasesResponse>(
        token,
        `${AIRTABLE_API_BASE}/meta/bases?${params.toString()}`
      );
      bases.push(...data.bases);
      offset = data.offset;
    } while (offset);

    return bases;
  }

  async listTables(token: AuthToken, baseId: string): Promise<AirtableTableSchema[]> {
    const data = await this.getJson<AirtableListTablesResponse>(
      token,
      `${AIRTABLE_API_BASE}/meta/bases/${baseId}/tables`
    );
    return data.tables;
  }

  /** Returns undefined (rather than failing) when the token lacks schema access. */
  private async findTableSchema(
    token: AuthToken,
    baseId: string,
    tableId: string
  ): Promise<AirtableTableSchema | undefined> {
    try {
      const tables = await this.listTables(token, baseId);
      return tables.find((table) => table.id === tableId || table.name === tableId);
    } catch (error) {
      logger.warn(
        { baseId, tableId, error: (error as Error).message },
        'Airtable schema unavailable'
      );
      return undefined;
    }
  }

  private async listRecords(
    token: AuthToken,
    baseId: string,
    tableId: string
  ): Promise<AirtableRecord[]> {
    const records: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams({ returnFieldsByFieldId: 'true' });
      if (offset) params.set('offset', offset);
      const data = await this.getJson<AirtableListRecordsResponse>(
        token,
        `${AIRTABLE_API_BASE}/${baseId}/${tableId}?${params.toString()}`
      );
      records.push(...data.records);
      offset = data.offset;
    } while (offset);

    return records;
  }

  /** GET with Bearer auth, retrying on 429 and throwing on any other failure. */
  private async getJson<T>(token: AuthToken, url: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });

      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        logger.warn({ url, attempt }, 'Airtable rate limit hit, waiting before retry');
        await this.delay(this.rateLimitWaitMs);
        continue;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as AirtableErrorResponse;
        throw new Error(`Airtable request failed (${response.status}): ${describeError(body)}`);
      }

      return (await response.json()) as T;
    }
  }

  private requestToken(body: Record<string, string>): Promise<Response> {
    const basicAuth = Buffer.from(
      `${config.airtableClientId}:${config.airtableClientSecret}`
    ).toString('base64');

    return fetch(`${AIRTABLE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams(body),
    });
  }
}

function toPropertySchema(baseId: string, field: AirtableFieldSchema): PropertySchema {
  const linkedTableId = field.options?.linkedTableId;
  return {
    id: field.id,
    name: field.name,
    type: mapAirtableFieldType(field.type),
    options: field.options?.choices,
    relationTargetDatabaseId: linkedTableId ? `${baseId}/${linkedTableId}` : undefined,
  };
}

function toAuthToken(data: AirtableTokenResponse): AuthToken {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    tokenType: data.token_type,
    scope: data.scope,
  };
}

function describeError(body: AirtableErrorResponse): string {
  if (typeof body.error === 'string') return body.error;
  return body.error?.message ?? body.error?.type ?? 'unknown error';
}
