import { NormalizedResult } from '../../transformers/interfaces.js';
import { FieldPlan, MigrationPlan, TablePlan } from '../plan/plan.types.js';
import { NotionAmbiguousWriteError } from '../notion/notion-writer.interface.js';
import { FailureStage, MigrationReport, SkippedValue, TableReport } from './migration-report.js';

const MAX_SKIPPED_SAMPLES = 50;

export interface RunOptions {
  runId: string;
  /** Notion page the new databases are created under; it must be shared with the integration. */
  parentPageId: string;
  dryRun?: boolean;
}

/** Shared state of one migration run: the plan, the source records, and the report being built. */
export class RunContext {
  readonly report: MigrationReport;
  readonly recordsByTable = new Map<string, NormalizedResult[]>();
  readonly tableOfRecord = new Map<string, TablePlan>();
  /** Source table ID -> Notion data source ID, for tables that exist in Notion. */
  readonly dataSources = new Map<string, string>();
  /** "tableId\u0000propertyName" of relation properties that exist in Notion. */
  readonly relationProperties = new Set<string>();
  private readonly tableReports = new Map<string, TableReport>();
  private readonly fieldsByName = new Map<string, Map<string, FieldPlan>>();

  constructor(
    readonly plan: MigrationPlan,
    results: NormalizedResult[],
    readonly options: RunOptions
  ) {
    for (const table of plan.tables) {
      const records = results.filter(
        (r) => r.entity.entityType === 'record' && r.entity.parentId === table.sourceDatabaseId
      );
      this.recordsByTable.set(table.sourceDatabaseId, records);
      records.forEach((r) => this.tableOfRecord.set(r.entity.id, table));
      this.fieldsByName.set(
        table.sourceDatabaseId,
        new Map(table.fields.map((f) => [f.sourceName, f]))
      );
      const tableReport: TableReport = {
        table: table.name,
        sourceDatabaseId: table.sourceDatabaseId,
        records: { planned: records.length, created: 0, alreadyDone: 0, failed: 0 },
      };
      this.tableReports.set(table.sourceDatabaseId, tableReport);
    }

    this.report = {
      runId: options.runId,
      dryRun: options.dryRun ?? false,
      startedAt: new Date(),
      finishedAt: new Date(),
      tables: [...this.tableReports.values()],
      links: { planned: 0, written: 0, unresolved: 0, truncated: 0 },
      valuesSkipped: { count: 0, samples: [] },
      filesNotCopied: 0,
      lossyFields: plan.warnings,
      failures: [],
      unresolvedLinks: [],
      complete: false,
    };
  }

  tableReport(table: TablePlan): TableReport {
    return this.tableReports.get(table.sourceDatabaseId)!;
  }

  field(table: TablePlan, sourceName: string): FieldPlan | undefined {
    return this.fieldsByName.get(table.sourceDatabaseId)?.get(sourceName);
  }

  fail(stage: FailureStage, table: TablePlan, sourceId: string, error: unknown): void {
    this.report.failures.push({
      stage,
      table: table.name,
      sourceId,
      error: error instanceof Error ? error.message : String(error),
      needsVerification: error instanceof NotionAmbiguousWriteError,
    });
  }

  skipValue(value: SkippedValue): void {
    this.report.valuesSkipped.count++;
    if (this.report.valuesSkipped.samples.length < MAX_SKIPPED_SAMPLES) {
      this.report.valuesSkipped.samples.push(value);
    }
  }

  finish(): MigrationReport {
    this.report.finishedAt = new Date();
    this.report.complete =
      this.report.failures.length === 0 &&
      this.report.links.unresolved === 0 &&
      this.report.tables.every((t) => t.records.failed === 0);
    return this.report;
  }
}
