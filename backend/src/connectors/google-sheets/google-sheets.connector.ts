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

const GOOGLE_OAUTH_BASE = 'https://oauth2.googleapis.com';
const GOOGLE_SHEETS_API = 'https://sheets.googleapis.com/v4';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';

export class GoogleSheetsConnector extends BaseConnector {
  readonly name = 'google_sheets';
  readonly platform = 'google_sheets' as const;
  readonly version = '1.0.0';
  readonly tier = 'community' as const;

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.googleClientId || '',
      redirect_uri: config.googleRedirectUri || '',
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async authenticate(credentials: OAuthCredentials): Promise<AuthToken> {
    const response = await fetch(`${GOOGLE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.googleClientId || '',
        client_secret: config.googleClientSecret || '',
        code: credentials.code,
        grant_type: 'authorization_code',
        redirect_uri: credentials.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error({ error }, 'Google OAuth failed');
      throw new Error(`Google authentication failed: ${error.error}`);
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

    const response = await fetch(`${GOOGLE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.googleClientId || '',
        client_secret: config.googleClientSecret || '',
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Google token');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: token.refreshToken, // Keep the original refresh token
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async revokeToken(token: AuthToken): Promise<void> {
    await fetch(`${GOOGLE_OAUTH_BASE}/revoke?token=${token.accessToken}`, {
      method: 'POST',
    });
  }

  async discoverSchema(token: AuthToken): Promise<SourceSchema> {
    // List all spreadsheets from Google Drive
    const response = await this.makeRequest(
      token,
      `${GOOGLE_DRIVE_API}/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime)`
    );
    const data = await response.json();

    const databases: SourceSchema['databases'] = [];

    for (const file of data.files || []) {
      // Get spreadsheet metadata to discover sheets
      const sheetResponse = await this.makeRequest(
        token,
        `${GOOGLE_SHEETS_API}/spreadsheets/${file.id}?fields=sheets.properties`
      );
      const sheetData = await sheetResponse.json();

      for (const sheet of sheetData.sheets || []) {
        databases.push({
          id: `${file.id}/${sheet.properties.sheetId}`,
          title: `${file.name} / ${sheet.properties.title}`,
          properties: [], // Properties discovered during extraction
          estimatedRecords: sheet.properties.gridProperties?.rowCount,
        });
      }
    }

    return { databases };
  }

  async listEntities(token: AuthToken, filter?: EntityFilter): Promise<EntityList> {
    const response = await this.makeRequest(
      token,
      `${GOOGLE_DRIVE_API}/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime)&pageSize=${filter?.pageSize || 100}`
    );
    const data = await response.json();

    return {
      items: (data.files || []).map((file: { id: string; name: string; modifiedTime: string }) => ({
        id: file.id,
        type: 'database' as const,
        title: file.name,
        updatedAt: new Date(file.modifiedTime),
      })),
      hasMore: !!data.nextPageToken,
      nextCursor: data.nextPageToken,
    };
  }

  async extractEntity(token: AuthToken, id: string): Promise<RawEntity> {
    const [spreadsheetId, sheetId] = id.split('/');

    // Get spreadsheet metadata
    const metaResponse = await this.makeRequest(
      token,
      `${GOOGLE_SHEETS_API}/spreadsheets/${spreadsheetId}?fields=sheets.properties`
    );
    const metaData = await metaResponse.json();

    // Find the sheet name
    const sheet = metaData.sheets.find(
      (s: { properties: { sheetId: number } }) => s.properties.sheetId === parseInt(sheetId)
    );
    const sheetName = sheet?.properties?.title || 'Sheet1';

    // Get all data from the sheet
    const dataResponse = await this.makeRequest(
      token,
      `${GOOGLE_SHEETS_API}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`
    );
    const data = await dataResponse.json();

    return {
      id,
      type: 'sheet',
      rawData: {
        spreadsheetId,
        sheetId,
        sheetName,
        values: data.values || [],
      },
      extractedAt: new Date(),
    };
  }

  getRateLimits(): RateLimitConfig {
    return {
      requestsPerSecond: 1, // Google is more generous but we're conservative
      burstSize: 60,
      dailyLimit: 500, // Per-user quota
    };
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsIncrementalSync: false,
      supportsRelations: false,
      supportsAttachments: false,
      supportsComments: false,
      supportsRichText: false,
      supportsFullExport: true,
      maxPageSize: 1000,
    };
  }

  private async makeRequest(token: AuthToken, url: string): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });

    if (response.status === 401) {
      throw new Error('Token expired');
    }

    return response;
  }
}
