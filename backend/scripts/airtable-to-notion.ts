/**
 * Terminal command: move an Airtable base into Notion.
 *
 *   npm run airtable-to-notion -- --base appXXXX --dry-run
 *   npm run airtable-to-notion -- --base appXXXX --parent <Notion page URL>
 *
 * Progress is kept in a local SQLite file, so re-running the same command after an
 * interruption picks up where it stopped instead of creating duplicates.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// The shared config validates server settings at import time; this command needs none of them.
process.env.DATABASE_URL ??= 'postgresql://unused@localhost/unused';
process.env.JWT_SECRET ??= 'unused-by-the-command-line-migration-tool';
process.env.LOG_LEVEL ??= 'warn';

async function main(): Promise<number> {
  const { parseCliArgs, USAGE } = await import('../src/migration/cli/cli-args.js');
  if (process.argv.includes('--help')) {
    console.log(USAGE);
    return 0;
  }

  let options;
  try {
    options = parseCliArgs(process.argv.slice(2), process.env);
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${USAGE}`);
    return 1;
  }

  const { AirtableConnector } = await import('../src/connectors/airtable/airtable.connector.js');
  const { readAirtableBase } = await import('../src/migration/source/airtable-source.js');
  const migration = await import('../src/migration/index.js');

  console.log(`Reading Airtable base ${options.baseId}...`);
  const results = await readAirtableBase(
    new AirtableConnector(),
    { accessToken: options.airtableToken, tokenType: 'Bearer' },
    options.baseId,
    { tables: options.tables, onTable: (name, n) => console.log(`  ${name}: ${n} records`) }
  );
  const plan = migration.buildMigrationPlan(results);

  let report;
  if (options.dryRun) {
    report = await migration.dryRunMigration(plan, results, options.runId);
  } else {
    mkdirSync(options.stateDir, { recursive: true });
    const store = new migration.SqliteIdMapStore(join(options.stateDir, 'migrations.db'));
    try {
      console.log(`Writing to Notion (run ${options.runId}); this respects Notion's rate limit...`);
      const writer = new migration.NotionApiWriter(options.notionToken!);
      report = await new migration.MigrationRunner(writer, store).run(plan, results, {
        runId: options.runId,
        parentPageId: options.parentPageId!,
      });
    } finally {
      store.close();
    }
  }

  mkdirSync(options.stateDir, { recursive: true });
  const reportPath = join(options.stateDir, `${options.runId}.report.json`);
  writeFileSync(reportPath, JSON.stringify({ plan, report }, null, 2));

  console.log(`\n${migration.formatReport(report)}\n\nFull report: ${reportPath}`);
  return report.complete ? 0 : 2;
}

main().then(
  (code) => process.exit(code),
  (error: Error) => {
    console.error(`Migration stopped: ${error.message}`);
    process.exit(1);
  }
);
