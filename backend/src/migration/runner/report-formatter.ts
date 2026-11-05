import { MigrationReport } from './migration-report.js';

const MAX_LISTED = 10;

/** Plain-text summary of a migration report, for the terminal. */
export function formatReport(report: MigrationReport): string {
  return [
    header(report),
    tablesSection(report),
    linksSection(report),
    lossySection(report),
    problemsSection(report),
    verdict(report),
  ]
    .filter((section) => section.length > 0)
    .join('\n\n');
}

function header(report: MigrationReport): string {
  const mode = report.dryRun ? 'DRY RUN: nothing was written to Notion' : 'Migration run';
  const lines = [`${mode} (run ${report.runId})`];
  if (report.dryRun && report.plannedRequests !== undefined) {
    const minutes = Math.ceil(report.plannedRequests / 3 / 60);
    lines.push(
      `A real run would make ${report.plannedRequests} Notion requests, about ${minutes} min at Notion's rate limit.`
    );
  }
  return lines.join('\n');
}

function tablesSection(report: MigrationReport): string {
  const rows = report.tables.map((t) => {
    const { planned, created, alreadyDone, failed } = t.records;
    const parts = [`${created} created`];
    if (alreadyDone) parts.push(`${alreadyDone} already done`);
    if (failed) parts.push(`${failed} failed`);
    const url = t.url ? `  ${t.url}` : '';
    return `  ${t.table}: ${planned} records, ${parts.join(', ')}${url}`;
  });
  return ['Tables', ...rows].join('\n');
}

function linksSection(report: MigrationReport): string {
  const { planned, written, unresolved, truncated } = report.links;
  const lines = [`Links: ${written} of ${planned} written`];
  if (unresolved)
    lines.push(`  ${unresolved} could not be linked (a record on one end is missing)`);
  if (truncated) lines.push(`  ${truncated} dropped by Notion's 100-links-per-field limit`);
  return lines.join('\n');
}

function lossySection(report: MigrationReport): string {
  const lines: string[] = [];
  if (report.lossyFields.length) {
    lines.push('Will not move exactly');
    report.lossyFields.forEach((w) => lines.push(`  ${w.table} / ${w.field}: ${w.message}`));
  }
  if (report.filesNotCopied) lines.push(`Files not copied yet: ${report.filesNotCopied}`);
  if (report.valuesSkipped.count) {
    lines.push(`Values that could not be carried over: ${report.valuesSkipped.count}`);
    report.valuesSkipped.samples
      .slice(0, MAX_LISTED)
      .forEach((v) => lines.push(`  ${v.table} / ${v.field} on ${v.recordId}: "${v.value}"`));
  }
  return lines.join('\n');
}

function problemsSection(report: MigrationReport): string {
  if (!report.failures.length) return '';
  const lines = [`Failures: ${report.failures.length}`];
  report.failures.slice(0, MAX_LISTED).forEach((f) => {
    const check = f.needsVerification ? ' (may have been saved; check before re-running)' : '';
    lines.push(`  [${f.stage}] ${f.table} ${f.sourceId}: ${f.error}${check}`);
  });
  if (report.failures.length > MAX_LISTED)
    lines.push(`  ...and ${report.failures.length - MAX_LISTED} more`);
  return lines.join('\n');
}

function verdict(report: MigrationReport): string {
  if (report.complete) return 'Result: every record and link made it across.';
  return 'Result: incomplete. Re-run with the same run ID to retry only what is missing.';
}
