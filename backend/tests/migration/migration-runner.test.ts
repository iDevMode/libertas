import { AirtableNormalizer } from '../../src/connectors/airtable/airtable.normalizer';
import {
  MemoryIdMapStore,
  MigrationRunner,
  NotionAmbiguousWriteError,
  buildMigrationPlan,
  dryRunMigration,
} from '../../src/migration';
import { NormalizedResult } from '../../src/transformers/interfaces';
import { ALL_TABLE_IDS, RECORDS, REC, rawTable } from '../fixtures/airtable/agency-base';
import { FakeNotionWriter, FakePage } from './fake-notion.writer';

const results: NormalizedResult[] = ALL_TABLE_IDS.flatMap((id) =>
  new AirtableNormalizer().normalizeTable(rawTable(id))
);
const plan = buildMigrationPlan(results);
const recordCount = Object.values(RECORDS).flat().length;
const linkCount = results
  .flatMap((r) => r.relations)
  .filter((r) => r.relationType === 'related_to').length;
const options = { runId: 'run-1', parentPageId: 'parent-page' };

function relationIds(page: FakePage, property: string): string[] {
  const value = page.properties[property] as { relation?: Array<{ id: string }> } | undefined;
  return (value?.relation ?? []).map((r) => r.id);
}

async function migrate(writer = new FakeNotionWriter(), store = new MemoryIdMapStore()) {
  const report = await new MigrationRunner(writer, store).run(plan, results, options);
  return { writer, store, report };
}

describe('MigrationRunner: a full Airtable base into Notion', () => {
  it('creates one database per table under the parent page', async () => {
    const { writer, report } = await migrate();
    expect(writer.databases.map((d) => d.title)).toEqual([
      'Clients',
      'Projects',
      'Tasks',
      'People',
      'Invoices',
    ]);
    expect(writer.databases.every((d) => d.parentPageId === 'parent-page')).toBe(true);
    expect(report.tables.every((t) => t.dataSourceId && t.url)).toBe(true);
  });

  it('creates databases without relations, then adds relations pointing at the right data sources', async () => {
    const { writer } = await migrate();
    const firstPage = writer.calls.findIndex((c) => c.startsWith('createPage'));
    const lastSchemaChange = writer.calls
      .map((c) => c.startsWith('addDataSourceProperties'))
      .lastIndexOf(true);
    expect(lastSchemaChange).toBeLessThan(firstPage);

    const tasks = writer.databaseByTitle('Tasks');
    expect(tasks.schema['Assignee']).toEqual({
      type: 'relation',
      relation: {
        data_source_id: writer.databaseByTitle('People').dataSourceId,
        type: 'single_property',
        single_property: {},
      },
    });
    expect(tasks.schema['Title']).toEqual({ type: 'title', title: {} });
    expect(tasks.schema['Airtable record ID']).toEqual({ type: 'rich_text', rich_text: {} });
  });

  it('creates a page per record, carrying titles, values and the source record ID', async () => {
    const { writer, report } = await migrate();
    expect(writer.pages.size).toBe(recordCount);
    expect(report.tables.reduce((sum, t) => sum + t.records.created, 0)).toBe(recordCount);

    const website = writer.pageForSource(REC.website);
    expect(website.properties['Name']).toEqual({
      title: [{ type: 'text', text: { content: 'Website redesign' } }],
    });
    expect(website.properties['Status']).toEqual({ select: { name: 'Active' } });
    expect(website.properties['Budget']).toEqual({ number: 12500.5 });
    expect(website.properties['Start']).toEqual({ date: { start: '2026-02-01' } });
    expect(website.properties['Total hours']).toEqual({ number: 42.5 });

    const copy = writer.pageForSource(REC.copy);
    expect(copy.properties['Tags']).toEqual({
      multi_select: [{ name: 'Copy' }, { name: 'Design' }],
    });
    expect(copy.properties['Client name']).toEqual({
      rich_text: [{ type: 'text', text: { content: 'Acme Ltd' } }],
    });
    expect(writer.pageForSource(REC.wireframes).properties['Done']).toEqual({ checkbox: true });
  });

  it('rebuilds every link between the new pages', async () => {
    const { writer, report } = await migrate();
    expect(report.links).toEqual({
      planned: linkCount,
      written: linkCount,
      unresolved: 0,
      truncated: 0,
    });

    const launch = writer.pageForSource(REC.launch);
    expect(relationIds(launch, 'Assignee').sort()).toEqual(
      [writer.pageForSource(REC.ada).pageId, writer.pageForSource(REC.linus).pageId].sort()
    );
    const acme = writer.pageForSource(REC.acme);
    expect(relationIds(acme, 'Invoices')).toHaveLength(2);
    expect(
      relationIds(acme, 'Invoices').every((id) =>
        writer.pagesIn('Invoices').some((p) => p.pageId === id)
      )
    ).toBe(true);
  });

  it('reports what did not move exactly, and calls the result complete', async () => {
    const { report } = await migrate();
    expect(report.filesNotCopied).toBe(5);
    expect(report.valuesSkipped).toEqual({
      count: 1,
      samples: [
        { table: 'Invoices', recordId: REC.inv3, field: 'Amount with VAT', value: '#ERROR!' },
      ],
    });
    expect(report.lossyFields.length).toBeGreaterThan(0);
    expect(report.failures).toEqual([]);
    expect(report.complete).toBe(true);
  });
});

describe('MigrationRunner: failures and resuming', () => {
  it('records a failed page, reports its links as unresolved, and finishes everything else', async () => {
    const writer = new FakeNotionWriter();
    writer.failCreatePage = (_ds, props) =>
      JSON.stringify(props).includes(REC.ada)
        ? new Error('validation_error: bad value')
        : undefined;

    const { report, store } = await migrate(writer);

    expect(writer.pages.size).toBe(recordCount - 1);
    expect(report.failures).toEqual([
      {
        stage: 'page',
        table: 'People',
        sourceId: REC.ada,
        error: 'validation_error: bad value',
        needsVerification: false,
      },
    ]);
    expect(store.get('run-1', 'entity', REC.ada)).toMatchObject({ status: 'failed' });
    expect(report.links.unresolved).toBeGreaterThan(0);
    expect(report.links.written + report.links.unresolved).toBe(linkCount);
    expect(report.complete).toBe(false);
  });

  it('re-running the same run creates only what is missing and completes the links', async () => {
    const writer = new FakeNotionWriter();
    const store = new MemoryIdMapStore();
    writer.failCreatePage = (_ds, props) =>
      JSON.stringify(props).includes(REC.ada) ? new Error('timeout') : undefined;
    await migrate(writer, store);

    writer.failCreatePage = undefined;
    const { report } = await migrate(writer, store);

    expect(writer.databases).toHaveLength(5);
    expect(writer.pages.size).toBe(recordCount);
    const people = report.tables.find((t) => t.table === 'People')!;
    expect(people.records).toEqual({ planned: 3, created: 1, alreadyDone: 2, failed: 0 });
    expect(report.links.written).toBe(linkCount);
    expect(relationIds(writer.pageForSource(REC.wireframes), 'Assignee')).toEqual([
      writer.pageForSource(REC.ada).pageId,
    ]);
    expect(report.complete).toBe(true);
  });

  it('flags writes that may have been saved despite an error', async () => {
    const writer = new FakeNotionWriter();
    writer.failCreatePage = (_ds, props) =>
      JSON.stringify(props).includes(REC.inv1)
        ? new NotionAmbiguousWriteError(503, 'unavailable')
        : undefined;

    const { report } = await migrate(writer);

    expect(report.failures[0]).toMatchObject({ sourceId: REC.inv1, needsVerification: true });
  });

  it('skips the records of a table whose database could not be created', async () => {
    const writer = new FakeNotionWriter();
    writer.failCreateDatabase = (title) =>
      title === 'Invoices' ? new Error('restricted_resource') : undefined;

    const { report } = await migrate(writer);

    expect(writer.databases).toHaveLength(4);
    expect(report.tables.find((t) => t.table === 'Invoices')!.records).toMatchObject({
      planned: 3,
      failed: 3,
    });
    expect(report.failures.map((f) => f.stage)).toContain('database');
    expect(writer.pages.size).toBe(recordCount - 3);
  });

  it('counts links as unresolved when their relation property could not be added', async () => {
    const writer = new FakeNotionWriter();
    writer.failAddProperties = (ds) =>
      ds === 'ds-3' ? new Error('validation_error: schema too large') : undefined;

    const { report } = await migrate(writer);

    expect(report.failures).toEqual([expect.objectContaining({ stage: 'schema', table: 'Tasks' })]);
    expect(report.links.written).toBeLessThan(linkCount);
    expect(report.links.written + report.links.unresolved).toBe(linkCount);
    expect(relationIds(writer.pageForSource(REC.launch), 'Assignee')).toEqual([]);
  });

  it('does not count links as written when the page update fails', async () => {
    const writer = new FakeNotionWriter();
    writer.failUpdatePage = () => new Error('conflict_error');

    const { report } = await migrate(writer);

    expect(report.links.written).toBe(0);
    expect(report.failures.every((f) => f.stage === 'links')).toBe(true);
    expect(report.complete).toBe(false);
  });
});

describe('MigrationRunner: Notion limits', () => {
  it('writes at most 100 links per field and reports the rest', async () => {
    const tableId = 'appBig/tblBig';
    const table: NormalizedResult = {
      entity: {
        id: tableId,
        entityType: 'database',
        title: 'Big',
        sourcePlatform: 'airtable',
        metadata: {
          primaryFieldId: 'fldName',
          recordCount: 102,
          fields: [
            {
              id: 'fldName',
              name: 'Name',
              airtableType: 'singleLineText',
              propertyType: 'text',
              computed: false,
            },
            {
              id: 'fldLinks',
              name: 'Links',
              airtableType: 'multipleRecordLinks',
              propertyType: 'relation',
              computed: false,
              linkedDatabaseId: tableId,
            },
          ],
        },
      },
      properties: [],
      relations: [],
      contentBlocks: [],
      attachments: [],
    };
    const record = (id: string): NormalizedResult => ({
      entity: {
        id,
        entityType: 'record',
        title: id,
        parentId: tableId,
        sourcePlatform: 'airtable',
      },
      properties: [],
      relations: [],
      contentBlocks: [],
      attachments: [],
    });
    const hub = record('rec-hub');
    const spokes = Array.from({ length: 101 }, (_, i) => record(`rec-${i}`));
    hub.relations = spokes.map((s) => ({
      id: `l-${s.entity.id}`,
      fromEntityId: 'rec-hub',
      toEntityId: s.entity.id,
      relationType: 'related_to' as const,
      metadata: { propertyName: 'Links' },
    }));
    const bigResults = [table, hub, ...spokes];
    const writer = new FakeNotionWriter();

    const report = await new MigrationRunner(writer, new MemoryIdMapStore()).run(
      buildMigrationPlan(bigResults),
      bigResults,
      options
    );

    expect(relationIds(writer.pageForSource('rec-hub'), 'Links')).toHaveLength(100);
    expect(report.links).toMatchObject({ planned: 101, written: 100, truncated: 1 });
    expect(report.complete).toBe(false);
  });
});

describe('MigrationRunner: re-running never duplicates', () => {
  const unavailable = new NotionAmbiguousWriteError(503, 'unavailable');
  const forAda = (_target: string, props: unknown) =>
    JSON.stringify(props).includes(REC.ada) ? unavailable : undefined;
  const firstTable = plan.tables[0].name;
  const forFirstTable = (title: string) => (title === firstTable ? unavailable : undefined);

  /** Leaves mappings pending, as a process killed between the write and recording it would. */
  class CrashingStore extends MemoryIdMapStore {
    override markFailed(...args: Parameters<MemoryIdMapStore['markFailed']>) {
      return this.get(args[0], args[1], args[2])!;
    }
  }

  it('finds a page that was saved despite a server error instead of creating it again', async () => {
    const writer = new FakeNotionWriter();
    const store = new MemoryIdMapStore();
    writer.failCreatePageAfterSaving = forAda;
    const first = await migrate(writer, store);
    expect(first.report.complete).toBe(false);
    expect(writer.pages.size).toBe(recordCount);

    writer.failCreatePageAfterSaving = undefined;
    const { report } = await migrate(writer, store);

    expect(writer.pages.size).toBe(recordCount);
    const people = report.tables.find((t) => t.table === 'People')!;
    expect(people.records).toEqual({ planned: 3, created: 0, alreadyDone: 3, failed: 0 });
    expect(relationIds(writer.pageForSource(REC.wireframes), 'Assignee')).toEqual([
      writer.pageForSource(REC.ada).pageId,
    ]);
    expect(report.complete).toBe(true);
  });

  it('creates the page when the server error really did lose it', async () => {
    const writer = new FakeNotionWriter();
    const store = new MemoryIdMapStore();
    writer.failCreatePage = forAda;
    await migrate(writer, store);
    expect(writer.pages.size).toBe(recordCount - 1);

    writer.failCreatePage = undefined;
    const { report } = await migrate(writer, store);

    expect(writer.pages.size).toBe(recordCount);
    expect(report.complete).toBe(true);
  });

  it('finds a page saved just before a crash', async () => {
    const writer = new FakeNotionWriter();
    const store = new CrashingStore();
    writer.failCreatePageAfterSaving = forAda;
    await migrate(writer, store);
    expect(store.get('run-1', 'entity', REC.ada)?.status).toBe('pending');

    writer.failCreatePageAfterSaving = undefined;
    const { report } = await migrate(writer, store);

    expect(writer.pages.size).toBe(recordCount);
    expect(report.complete).toBe(true);
  });

  it('finds a database saved despite a server error instead of creating it again', async () => {
    const writer = new FakeNotionWriter();
    const store = new MemoryIdMapStore();
    writer.failCreateDatabaseAfterSaving = forFirstTable;
    await migrate(writer, store);
    expect(writer.databases).toHaveLength(5);

    writer.failCreateDatabaseAfterSaving = undefined;
    const { report } = await migrate(writer, store);

    expect(writer.databases).toHaveLength(5);
    expect(writer.pages.size).toBe(recordCount);
    expect(report.complete).toBe(true);
  });

  it('finds a database saved just before a crash', async () => {
    const writer = new FakeNotionWriter();
    const store = new CrashingStore();
    writer.failCreateDatabaseAfterSaving = forFirstTable;
    await migrate(writer, store);

    writer.failCreateDatabaseAfterSaving = undefined;
    const { report } = await migrate(writer, store);

    expect(writer.databases).toHaveLength(5);
    expect(report.complete).toBe(true);
  });

  it('creates nothing when it cannot check, and leaves the record for the next run', async () => {
    const writer = new FakeNotionWriter();
    const store = new MemoryIdMapStore();
    writer.failCreatePageAfterSaving = forAda;
    await migrate(writer, store);

    writer.failCreatePageAfterSaving = undefined;
    writer.failFind = () => new Error('lookup failed');
    const second = await migrate(writer, store);
    expect(writer.pages.size).toBe(recordCount);
    expect(second.report.complete).toBe(false);
    expect(second.report.failures[0]).toMatchObject({ stage: 'page', sourceId: REC.ada });

    writer.failFind = undefined;
    const third = await migrate(writer, store);
    expect(writer.pages.size).toBe(recordCount);
    expect(third.report.complete).toBe(true);
  });

  it('spends no lookups on a first run or on work already finished', async () => {
    const writer = new FakeNotionWriter();
    const store = new MemoryIdMapStore();
    await migrate(writer, store);
    await migrate(writer, store);
    expect(writer.calls.filter((c) => c.startsWith('find'))).toEqual([]);
  });
});

describe('dryRunMigration', () => {
  it('runs the whole migration without touching Notion and counts the requests', async () => {
    const report = await dryRunMigration(plan, results);

    // 5 databases + 5 relation-property updates + one page per record + one link update per record
    expect(report.plannedRequests).toBe(5 + 5 + recordCount + recordCount);
    expect(report).toMatchObject({ dryRun: true, complete: true });
    expect(report.links.written).toBe(linkCount);
    expect(report.tables.every((t) => t.records.created === t.records.planned)).toBe(true);
  });
});
