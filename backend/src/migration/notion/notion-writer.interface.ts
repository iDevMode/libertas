import { NotionPropertyValue, NotionSchemaConfig } from './notion-values.js';

export interface CreatedDatabase {
  databaseId: string;
  /** Pages and relations address the data source inside the database, not the database. */
  dataSourceId: string;
  url?: string;
}

export interface CreateDatabaseInput {
  parentPageId: string;
  title: string;
  properties: Record<string, NotionSchemaConfig>;
}

/** The writes a migration needs from Notion. Implemented by the API client and the dry run. */
export interface INotionWriter {
  createDatabase(input: CreateDatabaseInput): Promise<CreatedDatabase>;
  addDataSourceProperties(
    dataSourceId: string,
    properties: Record<string, NotionSchemaConfig>
  ): Promise<void>;
  createPage(
    dataSourceId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<{ pageId: string }>;
  updatePageProperties(
    pageId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<void>;
  /**
   * Finds a database an earlier attempt may have saved: under this parent, with this title
   * and the source-ID property. Throws if several match, rather than guessing.
   */
  findDatabase(
    parentPageId: string,
    title: string,
    sourceIdPropertyName: string
  ): Promise<CreatedDatabase | undefined>;
  /** Finds a page an earlier attempt may have saved, by its source-ID property. */
  findPageBySourceId(
    dataSourceId: string,
    sourceIdPropertyName: string,
    sourceId: string
  ): Promise<{ pageId: string } | undefined>;
}

/** Notion rejected the request; retrying the same request will not help. */
export class NotionApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(`Notion API ${status} ${code}: ${message}`);
    this.name = 'NotionApiError';
  }
}

/**
 * A write failed with a server error after reaching Notion, so it may or may not have been
 * saved. It is not retried within a run; the next run looks for it before creating anything.
 */
export class NotionAmbiguousWriteError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(`Notion write may or may not have been saved (${status}): ${message}`);
    this.name = 'NotionAmbiguousWriteError';
  }
}
