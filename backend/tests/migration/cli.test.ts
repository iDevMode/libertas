import { parseCliArgs, parseNotionPageId } from '../../src/migration/cli/cli-args';
import { readAirtableBase } from '../../src/migration/source/airtable-source';
import { AirtableConnector } from '../../src/connectors/airtable/airtable.connector';
import {
  buildMigrationPlan,
  dryRunMigration,
  formatReport,
  MigrationReport,
} from '../../src/migration';
import { BASE_ID, RECORDS, TABLES } from '../fixtures/airtable/agency-base';

const PAGE = '1f2e3d4c5b6a7980a1b2c3d4e5f60718';
const PAGE_UUID = '1f2e3d4c-5b6a-7980-a1b2-c3d4e5f60718';
const env = { AIRTABLE_TOKEN: 'pat123', NOTION_TOKEN: 'ntn_456' };

describe('parseNotionPageId', () => {
  it.each([
    [PAGE],
    [PAGE_UUID],
    [`https://www.notion.so/acme/Migration-target-${PAGE}`],
    [`https://www.notion.so/${PAGE}?v=abcdef0123456789abcdef0123456789&pvs=4`],
  ])('reads the page ID from %s', (input) => {
    expect(parseNotionPageId(input)).toBe(PAGE_UUID);
  });

  it('rejects text without a page ID', () => {
    expect(() => parseNotionPageId('https://www.notion.so/acme/Home')).toThrow(
      'Not a Notion page URL or ID'
    );
  });
});

describe('parseCliArgs', () => {
  it('accepts a dry run without a Notion page or token', () => {
    const options = parseCliArgs(['--base', BASE_ID, '--dry-run'], { AIRTABLE_TOKEN: 'pat' });
    expect(options).toMatchObject({
      baseId: BASE_ID,
      dryRun: true,
      runId: `${BASE_ID}-to-dry-run`,
    });
    expect(options.stateDir).toMatch(/\.libertas$/);
  });

  it('builds a stable run ID from base and page, so re-running resumes', () => {
    const options = parseCliArgs(
      ['--base', BASE_ID, '--parent', PAGE, '--tables', 'Tasks,People'],
      env
    );
    expect(options).toMatchObject({
      parentPageId: PAGE_UUID,
      tables: ['Tasks', 'People'],
      runId: `${BASE_ID}-to-${PAGE_UUID}`,
      notionToken: 'ntn_456',
    });
  });

  it('honours an explicit run ID and state directory', () => {
    const options = parseCliArgs(
      ['--base', BASE_ID, '--dry-run', '--run-id', 'trial', '--state-dir', '/tmp/x'],
      env
    );
    expect(options).toMatchObject({ runId: 'trial', stateDir: '/tmp/x' });
  });

  it.each([
    [['--dry-run'], env, '--base must be'],
    [['--base', 'nope', '--dry-run'], env, '--base must be'],
    [['--base', BASE_ID], env, '--parent is required'],
    [['--base', BASE_ID, '--dry-run'], {}, 'AIRTABLE_TOKEN'],
    [['--base', BASE_ID, '--parent', PAGE], { AIRTABLE_TOKEN: 'pat' }, 'NOTION_TOKEN'],
    [['--base', BASE_ID, '--surprise'], env, 'Unknown option'],
  ])('rejects %j', (argv, environment, message) => {
    expect(() => parseCliArgs(argv as string[], environment)).toThrow(message);
  });
});

describe('readAirtableBase', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const body = url.pathname.endsWith('/tables')
        ? { tables: TABLES }
        : { records: RECORDS[url.pathname.split('/').pop()!] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  const token = { accessToken: 'pat', tokenType: 'Bearer' };

  it('reads and normalises every table of a base', async () => {
    const seen: string[] = [];
    const results = await readAirtableBase(new AirtableConnector(), token, BASE_ID, {
      onTable: (name, n) => seen.push(`${name}:${n}`),
    });
    expect(seen).toEqual(['Clients:2', 'Projects:3', 'Tasks:6', 'People:3', 'Invoices:3']);
    expect(results.filter((r) => r.entity.entityType === 'record')).toHaveLength(17);
  });

  it('reads only the requested tables, by name or ID', async () => {
    const tasksId = TABLES.find((t) => t.name === 'Tasks')!.id;
    const results = await readAirtableBase(new AirtableConnector(), token, BASE_ID, {
      tables: [tasksId, ' People '],
    });
    expect(
      results.filter((r) => r.entity.entityType === 'database').map((r) => r.entity.title)
    ).toEqual(['Tasks', 'People']);
  });

  it('refuses unknown table names rather than silently skipping them', async () => {
    await expect(
      readAirtableBase(new AirtableConnector(), token, BASE_ID, { tables: ['Tasks', 'Taks'] })
    ).rejects.toThrow('Unknown table(s) in base');
  });

  it('feeds straight into a dry run', async () => {
    const results = await readAirtableBase(new AirtableConnector(), token, BASE_ID);
    const report = await dryRunMigration(buildMigrationPlan(results), results);
    expect(report.complete).toBe(true);
  });
});

describe('formatReport', () => {
  const base: MigrationReport = {
    runId: 'r1',
    dryRun: true,
    startedAt: new Date(),
    finishedAt: new Date(),
    tables: [
      {
        table: 'Tasks',
        sourceDatabaseId: 'a/b',
        url: 'https://notion.so/x',
        records: { planned: 6, created: 4, alreadyDone: 1, failed: 1 },
      },
    ],
    links: { planned: 10, written: 7, unresolved: 2, truncated: 1 },
    valuesSkipped: {
      count: 1,
      samples: [{ table: 'Invoices', recordId: 'rec1', field: 'VAT', value: '#ERROR!' }],
    },
    filesNotCopied: 3,
    lossyFields: [{ table: 'Tasks', field: 'Days left', message: 'Copied as a fixed value.' }],
    failures: [
      { stage: 'page', table: 'Tasks', sourceId: 'rec9', error: 'boom', needsVerification: true },
    ],
    unresolvedLinks: [],
    plannedRequests: 900,
    complete: false,
  };

  it('summarises a dry run for the terminal', () => {
    const text = formatReport(base);
    expect(text).toContain('DRY RUN: nothing was written to Notion');
    expect(text).toContain('900 Notion requests, about 5 min');
    expect(text).toContain(
      'Tasks: 6 records, 4 created, 1 already done, 1 failed  https://notion.so/x'
    );
    expect(text).toContain('Links: 7 of 10 written');
    expect(text).toContain("1 dropped by Notion's 100-links-per-field limit");
    expect(text).toContain('Tasks / Days left: Copied as a fixed value.');
    expect(text).toContain('Files not copied yet: 3');
    expect(text).toContain('Invoices / VAT on rec1: "#ERROR!"');
    expect(text).toContain('(may have been saved; check before re-running)');
    expect(text).toContain('Result: incomplete. Re-run with the same run ID');
  });

  it('reports a clean real run briefly', () => {
    const text = formatReport({
      ...base,
      dryRun: false,
      plannedRequests: undefined,
      tables: [
        { ...base.tables[0], records: { planned: 6, created: 6, alreadyDone: 0, failed: 0 } },
      ],
      links: { planned: 10, written: 10, unresolved: 0, truncated: 0 },
      valuesSkipped: { count: 0, samples: [] },
      filesNotCopied: 0,
      lossyFields: [],
      failures: [],
      complete: true,
    });
    expect(text).toContain('Migration run (run r1)');
    expect(text).not.toContain('Failures');
    expect(text).toContain('Result: every record and link made it across.');
  });

  it('notes when there are more failures than it lists', () => {
    const failures = Array.from({ length: 12 }, (_, i) => ({
      ...base.failures[0],
      sourceId: `rec${i}`,
      needsVerification: false,
    }));
    expect(formatReport({ ...base, failures })).toContain('...and 2 more');
  });
});
