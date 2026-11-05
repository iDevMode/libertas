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
 * saved. It is not retried automatically, to avoid duplicates; verification checks it later.
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
