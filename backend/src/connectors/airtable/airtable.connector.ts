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
} from '../interfaces.js';
import { config } from '../../common/config.js';
import { logger } from '../../common/logger.js';

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const AIRTABLE_OAUTH_BASE = 'https://airtable.com/oauth2/v1';

export class AirtableConnector extends BaseConnector {
  readonly name = 'airtable';
  readonly platform = 'airtable' as const;
  readonly version = '1.0.0';
  readonly tier = 'community' as const;

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
    const basicAuth = Buffer.from(
      `${config.airtableClientId}:${config.airtableClientSecret}`
    ).toString('base64');

    const response = await fetch(`${AIRTABLE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: credentials.code,
        redirect_uri: credentials.redirectUri,
        code_verifier: credentials.state || '',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error({ error }, 'Airtable OAuth failed');
      throw new Error(`Airtable authentication failed: ${error.error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async refreshToken(token: AuthToken): Promise<AuthToken> {
    if (!token.refreshToken) {
      throw new Error('No refresh token available');
    }

    const basicAuth = Buffer.from(
      `${config.airtableClientId}:${config.airtableClientSecret}`
    ).toString('base64');

    const response = await fetch(`${AIRTABLE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Airtable token');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async revokeToken(_token: AuthToken): Promise<void> {
    // Airtable doesn't have a token revocation endpoint
    logger.info('Airtable tokens must be revoked through Airtable settings');
  }

  async discoverSchema(token: AuthToken): Promise<SourceSchema> {
    // First, list all bases
    const basesResponse = await this.makeRequest(
      token,
      'https://api.airtable.com/v0/meta/bases'
    );
    const basesData = await basesResponse.json();

    const databases: SourceSchema['databases'] = [];

    for (const base of basesData.bases) {
      // Get schema for each base
      const schemaResponse = await this.makeRequest(
        token,
        `https://api.airtable.com/v0/meta/bases/${base.id}/tables`
      );
      const schemaData = await schemaResponse.json();

      for (const table of schemaData.tables) {
        databases.push({
          id: `${base.id}/${table.id}`,
          title: `${base.name} / ${table.name}`,
          properties: table.fields.map((field: { id: string; name: string; type: string; options?: { choices?: Array<{ id: string; name: string; color?: string }> } }) => ({
            id: field.id,
            name: field.name,
            type: this.mapAirtableFieldType(field.type),
            options: field.options?.choices,
          })),
        });
      }
    }

    return { databases };
  }

  async listEntities(token: AuthToken, filter?: EntityFilter): Promise<EntityList> {
    const basesResponse = await this.makeRequest(
      token,
      'https://api.airtable.com/v0/meta/bases'
    );
    const basesData = await basesResponse.json();

    const items = basesData.bases.map((base: { id: string; name: string }) => ({
      id: base.id,
      type: 'database' as const,
      title: base.name,
    }));

    return {
      items: items.slice(0, filter?.pageSize || 100),
      hasMore: false,
    };
  }

  async extractEntity(token: AuthToken, id: string): Promise<RawEntity> {
    const [baseId, tableId] = id.split('/');

    const records: unknown[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams();
      if (offset) params.set('offset', offset);

      const response = await this.makeRequest(
        token,
        `${AIRTABLE_API_BASE}/${baseId}/${tableId}?${params.toString()}`
      );
      const data = await response.json();

      records.push(...data.records);
      offset = data.offset;
    } while (offset);

    return {
      id,
      type: 'table',
      rawData: { baseId, tableId, records },
      extractedAt: new Date(),
    };
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

  private async makeRequest(token: AuthToken, url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });
  }

  private mapAirtableFieldType(airtableType: string): 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'relation' | 'file' | 'url' | 'email' | 'phone' | 'formula' | 'rollup' {
    const typeMap: Record<string, 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'relation' | 'file' | 'url' | 'email' | 'phone' | 'formula' | 'rollup'> = {
      singleLineText: 'text',
      multilineText: 'text',
      richText: 'text',
      number: 'number',
      currency: 'number',
      percent: 'number',
      singleSelect: 'select',
      multipleSelects: 'multi_select',
      date: 'date',
      dateTime: 'date',
      checkbox: 'boolean',
      url: 'url',
      email: 'email',
      phone: 'phone',
      multipleRecordLinks: 'relation',
      multipleAttachments: 'file',
      formula: 'formula',
      rollup: 'rollup',
    };

    return typeMap[airtableType] || 'text';
  }
}
