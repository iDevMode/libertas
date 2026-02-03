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

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_OAUTH_BASE = 'https://api.notion.com/v1/oauth';

export class NotionConnector extends BaseConnector {
  readonly name = 'notion';
  readonly platform = 'notion' as const;
  readonly version = '1.0.0';
  readonly tier = 'community' as const;

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.notionClientId || '',
      redirect_uri: config.notionRedirectUri || '',
      response_type: 'code',
      owner: 'user',
      state,
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async authenticate(credentials: OAuthCredentials): Promise<AuthToken> {
    const basicAuth = Buffer.from(
      `${config.notionClientId}:${config.notionClientSecret}`
    ).toString('base64');

    const response = await fetch(`${NOTION_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: credentials.code,
        redirect_uri: credentials.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error({ error }, 'Notion OAuth failed');
      throw new Error(`Notion authentication failed: ${error.error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      workspaceId: data.workspace_id,
      workspaceName: data.workspace_name,
    };
  }

  async refreshToken(_token: AuthToken): Promise<AuthToken> {
    // Notion tokens don't expire, so we just return the same token
    throw new Error('Notion tokens do not support refresh');
  }

  async revokeToken(_token: AuthToken): Promise<void> {
    // Notion doesn't support token revocation via API
    // Users must revoke access through Notion settings
    logger.info('Notion tokens must be revoked through Notion settings');
  }

  async discoverSchema(token: AuthToken): Promise<SourceSchema> {
    const databases: SourceSchema['databases'] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const response = await this.makeRequest(token, '/search', {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: 'object', value: 'database' },
          start_cursor: startCursor,
          page_size: 100,
        }),
      });

      const data = await response.json();

      for (const db of data.results) {
        databases.push({
          id: db.id,
          title: this.extractTitle(db.title),
          properties: this.extractPropertySchema(db.properties),
        });
      }

      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    return { databases };
  }

  async listEntities(token: AuthToken, filter?: EntityFilter): Promise<EntityList> {
    const response = await this.makeRequest(token, '/search', {
      method: 'POST',
      body: JSON.stringify({
        start_cursor: filter?.cursor,
        page_size: filter?.pageSize || 100,
      }),
    });

    const data = await response.json();

    return {
      items: data.results.map((item: Record<string, unknown>) => ({
        id: item.id as string,
        type: item.object === 'database' ? 'database' : 'page',
        title: this.extractEntityTitle(item),
        parentId: this.extractParentId(item.parent as Record<string, unknown>),
        updatedAt: new Date(item.last_edited_time as string),
      })),
      hasMore: data.has_more,
      nextCursor: data.next_cursor,
    };
  }

  async extractEntity(token: AuthToken, id: string): Promise<RawEntity> {
    // Try to fetch as page first, then as database
    let response = await this.makeRequest(token, `/pages/${id}`);

    if (!response.ok) {
      response = await this.makeRequest(token, `/databases/${id}`);
    }

    if (!response.ok) {
      throw new Error(`Failed to extract entity ${id}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      type: data.object,
      rawData: data,
      extractedAt: new Date(),
    };
  }

  getRateLimits(): RateLimitConfig {
    return {
      requestsPerSecond: 3,
      burstSize: 10,
    };
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsIncrementalSync: true,
      supportsRelations: true,
      supportsAttachments: true,
      supportsComments: true,
      supportsRichText: true,
      supportsFullExport: true,
      maxPageSize: 100,
    };
  }

  private async makeRequest(
    token: AuthToken,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${NOTION_API_BASE}${endpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  private extractTitle(titleArray: Array<{ plain_text: string }>): string {
    if (!titleArray || titleArray.length === 0) return 'Untitled';
    return titleArray.map((t) => t.plain_text).join('');
  }

  private extractEntityTitle(entity: Record<string, unknown>): string {
    if (entity.object === 'database') {
      return this.extractTitle(entity.title as Array<{ plain_text: string }>);
    }

    const properties = entity.properties as Record<string, { title?: Array<{ plain_text: string }> }>;
    for (const prop of Object.values(properties)) {
      if (prop.title) {
        return this.extractTitle(prop.title);
      }
    }

    return 'Untitled';
  }

  private extractParentId(parent: Record<string, unknown>): string | undefined {
    if (parent.type === 'workspace') return undefined;
    if (parent.type === 'page_id') return parent.page_id as string;
    if (parent.type === 'database_id') return parent.database_id as string;
    return undefined;
  }

  private extractPropertySchema(properties: Record<string, unknown>): SourceSchema['databases'][0]['properties'] {
    return Object.entries(properties).map(([name, prop]) => {
      const property = prop as { id: string; type: string; select?: { options: Array<{ id: string; name: string; color: string }> }; multi_select?: { options: Array<{ id: string; name: string; color: string }> } };
      return {
        id: property.id,
        name,
        type: this.mapNotionPropertyType(property.type),
        options: property.select?.options || property.multi_select?.options,
      };
    });
  }

  private mapNotionPropertyType(notionType: string): 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'relation' | 'file' | 'url' | 'email' | 'phone' | 'formula' | 'rollup' {
    const typeMap: Record<string, 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'relation' | 'file' | 'url' | 'email' | 'phone' | 'formula' | 'rollup'> = {
      title: 'text',
      rich_text: 'text',
      number: 'number',
      select: 'select',
      multi_select: 'multi_select',
      date: 'date',
      checkbox: 'boolean',
      url: 'url',
      email: 'email',
      phone_number: 'phone',
      relation: 'relation',
      files: 'file',
      formula: 'formula',
      rollup: 'rollup',
    };

    return typeMap[notionType] || 'text';
  }
}
