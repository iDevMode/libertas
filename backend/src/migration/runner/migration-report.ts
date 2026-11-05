import { PlanWarning } from '../plan/plan.types.js';
import { UnresolvedLink } from '../relation-resolver.js';

export interface TableReport {
  table: string;
  sourceDatabaseId: string;
  databaseId?: string;
  dataSourceId?: string;
  url?: string;
  records: {
    planned: number;
    created: number;
    /** Created by an earlier, interrupted run of the same migration. */
    alreadyDone: number;
    failed: number;
  };
}

export type FailureStage = 'database' | 'schema' | 'page' | 'links';

export interface FailureReport {
  stage: FailureStage;
  table: string;
  sourceId: string;
  error: string;
  /** The write may have been saved despite the error; check before retrying. */
  needsVerification: boolean;
}

export interface SkippedValue {
  table: string;
  recordId: string;
  field: string;
  value: string;
}

export interface LinkReport {
  /** Links between records in the source. */
  planned: number;
  /** Links written to Notion. */
  written: number;
  /** Links whose source or target record does not exist in Notion. */
  unresolved: number;
  /** Links beyond Notion's 100-per-request limit on one field of one record. */
  truncated: number;
}

export interface MigrationReport {
  runId: string;
  dryRun: boolean;
  startedAt: Date;
  finishedAt: Date;
  tables: TableReport[];
  links: LinkReport;
  /** Values that had data in the source but could not be represented, e.g. formula errors. */
  valuesSkipped: { count: number; samples: SkippedValue[] };
  filesNotCopied: number;
  lossyFields: PlanWarning[];
  failures: FailureReport[];
  unresolvedLinks: UnresolvedLink[];
  /** Requests a real run would make; set for dry runs. */
  plannedRequests?: number;
  /** True when every record and every link made it across. */
  complete: boolean;
}
