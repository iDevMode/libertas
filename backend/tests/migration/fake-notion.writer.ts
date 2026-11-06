import { CreateDatabaseInput, CreatedDatabase, INotionWriter } from '../../src/migration';

type Properties = Record<string, Record<string, unknown>>;

export interface FakeDatabase {
  databaseId: string;
  dataSourceId: string;
  parentPageId: string;
  title: string;
  schema: Properties;
}

export interface FakePage {
  pageId: string;
  dataSourceId: string;
  properties: Properties;
}

type Failure = (target: string, properties: Properties) => Error | undefined;

/**
 * An in-memory Notion: keeps the databases and pages a run creates, enforces the same
 * rules the real API does (pages need an existing data source and only schema properties),
 * and can be told to fail specific requests.
 */
export class FakeNotionWriter implements INotionWriter {
  readonly databases: FakeDatabase[] = [];
  readonly pages = new Map<string, FakePage>();
  readonly calls: string[] = [];
  failCreateDatabase?: Failure;
  failAddProperties?: Failure;
  failCreatePage?: Failure;
  failUpdatePage?: Failure;
  /** Saves the object, then fails: what a 5xx after a successful write looks like. */
  failCreateDatabaseAfterSaving?: Failure;
  failCreatePageAfterSaving?: Failure;
  failFind?: () => Error | undefined;
  private counter = 0;

  async createDatabase(input: CreateDatabaseInput): Promise<CreatedDatabase> {
    this.calls.push(`createDatabase:${input.title}`);
    this.maybeFail(this.failCreateDatabase, input.title, input.properties);
    const n = ++this.counter;
    const db: FakeDatabase = {
      databaseId: `db-${n}`,
      dataSourceId: `ds-${n}`,
      parentPageId: input.parentPageId,
      title: input.title,
      schema: { ...input.properties } as Properties,
    };
    this.databases.push(db);
    this.maybeFail(this.failCreateDatabaseAfterSaving, input.title, input.properties);
    return {
      databaseId: db.databaseId,
      dataSourceId: db.dataSourceId,
      url: `https://notion.so/db-${n}`,
    };
  }

  async addDataSourceProperties(dataSourceId: string, properties: Properties): Promise<void> {
    this.calls.push(`addDataSourceProperties:${dataSourceId}`);
    this.maybeFail(this.failAddProperties, dataSourceId, properties);
    Object.assign(this.database(dataSourceId).schema, properties);
  }

  async createPage(dataSourceId: string, properties: Properties): Promise<{ pageId: string }> {
    this.calls.push(`createPage:${dataSourceId}`);
    this.checkSchema(dataSourceId, properties);
    this.maybeFail(this.failCreatePage, dataSourceId, properties);
    const pageId = `page-${++this.counter}`;
    this.pages.set(pageId, { pageId, dataSourceId, properties: { ...properties } });
    this.maybeFail(this.failCreatePageAfterSaving, dataSourceId, properties);
    return { pageId };
  }

  async findDatabase(
    parentPageId: string,
    title: string,
    sourceIdPropertyName: string
  ): Promise<CreatedDatabase | undefined> {
    this.calls.push(`findDatabase:${title}`);
    this.maybeFailFind();
    const db = this.databases.find(
      (d) =>
        d.parentPageId === parentPageId && d.title === title && sourceIdPropertyName in d.schema
    );
    return db && { databaseId: db.databaseId, dataSourceId: db.dataSourceId };
  }

  async findPageBySourceId(
    dataSourceId: string,
    sourceIdPropertyName: string,
    sourceId: string
  ): Promise<{ pageId: string } | undefined> {
    this.calls.push(`findPage:${sourceId}`);
    this.maybeFailFind();
    const page = [...this.pages.values()].find(
      (p) =>
        p.dataSourceId === dataSourceId &&
        JSON.stringify(p.properties[sourceIdPropertyName]).includes(`"content":"${sourceId}"`)
    );
    return page && { pageId: page.pageId };
  }

  private maybeFailFind(): void {
    const error = this.failFind?.();
    if (error) throw error;
  }

  async updatePageProperties(pageId: string, properties: Properties): Promise<void> {
    this.calls.push(`updatePageProperties:${pageId}`);
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`No page ${pageId}`);
    this.checkSchema(page.dataSourceId, properties);
    this.maybeFail(this.failUpdatePage, pageId, properties);
    Object.assign(page.properties, properties);
  }

  database(dataSourceId: string): FakeDatabase {
    const db = this.databases.find((d) => d.dataSourceId === dataSourceId);
    if (!db) throw new Error(`No data source ${dataSourceId}`);
    return db;
  }

  databaseByTitle(title: string): FakeDatabase {
    const db = this.databases.find((d) => d.title === title);
    if (!db) throw new Error(`No database ${title}`);
    return db;
  }

  pagesIn(title: string): FakePage[] {
    const db = this.databaseByTitle(title);
    return [...this.pages.values()].filter((p) => p.dataSourceId === db.dataSourceId);
  }

  /** The page whose source-ID property holds the given source record ID. */
  pageForSource(sourceId: string): FakePage {
    const page = [...this.pages.values()].find((p) =>
      Object.values(p.properties).some((v) => JSON.stringify(v).includes(`"content":"${sourceId}"`))
    );
    if (!page) throw new Error(`No page for ${sourceId}`);
    return page;
  }

  private checkSchema(dataSourceId: string, properties: Properties): void {
    const schema = this.database(dataSourceId).schema;
    for (const name of Object.keys(properties)) {
      if (!(name in schema))
        throw new Error(`validation_error: ${name} is not a property of ${dataSourceId}`);
    }
  }

  private maybeFail(failure: Failure | undefined, target: string, properties: Properties): void {
    const error = failure?.(target, properties);
    if (error) throw error;
  }
}
