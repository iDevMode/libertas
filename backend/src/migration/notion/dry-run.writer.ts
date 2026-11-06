import { NotionPropertyValue, NotionSchemaConfig } from './notion-values.js';
import { CreateDatabaseInput, CreatedDatabase, INotionWriter } from './notion-writer.interface.js';

export interface RecordedRequest {
  kind: 'createDatabase' | 'addDataSourceProperties' | 'createPage' | 'updatePageProperties';
  target: string;
  propertyNames: string[];
}

/**
 * Stands in for Notion during a dry run: nothing is sent, IDs are made up, and every
 * request is recorded so the report can show exactly what a real run would do.
 */
export class DryRunNotionWriter implements INotionWriter {
  readonly requests: RecordedRequest[] = [];
  private counter = 0;

  async createDatabase(input: CreateDatabaseInput): Promise<CreatedDatabase> {
    const n = ++this.counter;
    this.record('createDatabase', input.title, input.properties);
    return { databaseId: `dry-run-database-${n}`, dataSourceId: `dry-run-data-source-${n}` };
  }

  async addDataSourceProperties(
    dataSourceId: string,
    properties: Record<string, NotionSchemaConfig>
  ): Promise<void> {
    this.record('addDataSourceProperties', dataSourceId, properties);
  }

  async createPage(
    dataSourceId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<{ pageId: string }> {
    this.record('createPage', dataSourceId, properties);
    return { pageId: `dry-run-page-${++this.counter}` };
  }

  async updatePageProperties(
    pageId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<void> {
    this.record('updatePageProperties', pageId, properties);
  }

  /** A dry run starts from nothing, so there is never an earlier attempt to find. */
  async findDatabase(): Promise<CreatedDatabase | undefined> {
    return undefined;
  }

  async findPageBySourceId(): Promise<{ pageId: string } | undefined> {
    return undefined;
  }

  private record(
    kind: RecordedRequest['kind'],
    target: string,
    properties: Record<string, unknown>
  ): void {
    this.requests.push({ kind, target, propertyNames: Object.keys(properties) });
  }
}
