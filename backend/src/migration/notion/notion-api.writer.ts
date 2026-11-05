import { logger } from '../../common/logger.js';
import { NotionPropertyValue, NotionSchemaConfig, toRichText } from './notion-values.js';
import {
  CreateDatabaseInput,
  CreatedDatabase,
  INotionWriter,
  NotionAmbiguousWriteError,
  NotionApiError,
} from './notion-writer.interface.js';

export const NOTION_API_BASE = 'https://api.notion.com/v1';
export const NOTION_WRITE_API_VERSION = '2026-03-11';

export interface NotionApiWriterOptions {
  /** Minimum gap between requests. Notion allows about 3 per second on most plans. */
  minIntervalMs?: number;
  maxRetries?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

interface NotionErrorBody {
  code?: string;
  message?: string;
  rate_limit_reason?: string;
  additional_data?: { retry_after?: number };
}

interface DatabaseResponse {
  id: string;
  url?: string;
  data_sources?: Array<{ id: string; name?: string }>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Notion API client for the writes a migration makes, on API version 2026-03-11
 * (databases contain data sources; pages and relations point at data sources).
 *
 * Throttles to Notion's rate limit, honours Retry-After on 429/529, and never repeats
 * a write that failed with a server error, because it may already have been saved.
 */
export class NotionApiWriter implements INotionWriter {
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private nextSlot = 0;

  constructor(
    private readonly token: string,
    options: NotionApiWriterOptions = {}
  ) {
    this.minIntervalMs = options.minIntervalMs ?? 350;
    this.maxRetries = options.maxRetries ?? 5;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async createDatabase(input: CreateDatabaseInput): Promise<CreatedDatabase> {
    const created = await this.request<DatabaseResponse>('POST', '/databases', {
      parent: { type: 'page_id', page_id: input.parentPageId },
      title: toRichText(input.title),
      initial_data_source: { properties: input.properties },
    });
    // The create response may be partial; fetch the database to learn its data source.
    const database = created.data_sources?.length
      ? created
      : await this.request<DatabaseResponse>('GET', `/databases/${created.id}`);
    const dataSourceId = database.data_sources?.[0]?.id;
    if (!dataSourceId) {
      throw new NotionApiError(
        200,
        'missing_data_source',
        `Database ${created.id} has no data source`
      );
    }
    return { databaseId: created.id, dataSourceId, url: database.url ?? created.url };
  }

  async addDataSourceProperties(
    dataSourceId: string,
    properties: Record<string, NotionSchemaConfig>
  ): Promise<void> {
    await this.request('PATCH', `/data_sources/${dataSourceId}`, { properties });
  }

  async createPage(
    dataSourceId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<{ pageId: string }> {
    const page = await this.request<{ id: string }>('POST', '/pages', {
      parent: { type: 'data_source_id', data_source_id: dataSourceId },
      properties,
    });
    return { pageId: page.id };
  }

  async updatePageProperties(
    pageId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<void> {
    await this.request('PATCH', `/pages/${pageId}`, { properties });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      const response = await fetch(`${NOTION_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Notion-Version': NOTION_WRITE_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (response.ok) return (await response.json()) as T;

      const error = (await response.json().catch(() => ({}))) as NotionErrorBody;
      const wait = this.retryDelay(response, error, attempt, method);
      if (wait === undefined) throw this.toError(response.status, error, method);

      logger.warn(
        { path, status: response.status, attempt, wait },
        'Notion asked us to slow down; retrying'
      );
      await this.sleep(wait);
    }
  }

  /** Milliseconds to wait before retrying, or undefined if the request must not be retried. */
  private retryDelay(
    response: Response,
    error: NotionErrorBody,
    attempt: number,
    method: string
  ): number | undefined {
    if (attempt >= this.maxRetries) return undefined;
    const status = response.status;
    const rateLimited =
      (status === 429 && error.rate_limit_reason !== 'public_api_request_blocked') ||
      status === 529;
    const safeToRepeat = method === 'GET' && status >= 500 && status !== 529;
    if (!rateLimited && !safeToRepeat) return undefined;

    const retryAfter = Number(
      response.headers.get('Retry-After') ?? error.additional_data?.retry_after
    );
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
    return Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 250);
  }

  private toError(status: number, error: NotionErrorBody, method: string): Error {
    const message = error.message ?? 'unknown error';
    if (status >= 500 && status !== 529 && method !== 'GET') {
      return new NotionAmbiguousWriteError(status, message);
    }
    return new NotionApiError(status, error.code ?? 'unknown', message);
  }

  /** Spaces requests at least minIntervalMs apart, even when called concurrently. */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.minIntervalMs;
    if (slot > now) await this.sleep(slot - now);
  }
}
