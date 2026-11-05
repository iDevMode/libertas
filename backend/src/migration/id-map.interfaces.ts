/**
 * The ID map records, for each migration run, which destination object each source
 * object became. It is what lets a migration:
 *   - rebuild links once both ends exist in the destination,
 *   - resume after a failure without creating duplicates,
 *   - verify and roll back exactly what a run created.
 */

export type MappingKind = 'database' | 'entity' | 'attachment';
export type MappingStatus = 'pending' | 'created' | 'failed';

export interface IdMapping {
  runId: string;
  kind: MappingKind;
  sourceId: string;
  /** Set once the object exists in the destination. */
  targetId?: string;
  status: MappingStatus;
  /** Last failure message, cleared when the object is created. */
  error?: string;
  /** Number of create attempts recorded (successful or failed). */
  attempts: number;
  updatedAt: Date;
}

export interface MappingFilter {
  kind?: MappingKind;
  status?: MappingStatus;
}

export type StatusCounts = Record<MappingStatus, number>;

export interface IdMapSummary {
  total: number;
  byStatus: StatusCounts;
  byKind: Partial<Record<MappingKind, StatusCounts>>;
}

export interface IIdMapStore {
  /** Registers a source object as pending. Returns the existing mapping unchanged if one exists. */
  reserve(runId: string, kind: MappingKind, sourceId: string): IdMapping;

  /**
   * Records that the source object now exists in the destination.
   * Repeating the same call is a no-op; a different targetId for the same source,
   * or a targetId already used by another source, throws IdMapConflictError.
   */
  markCreated(runId: string, kind: MappingKind, sourceId: string, targetId: string): IdMapping;

  /** Records a failed attempt. Throws IdMapStateError if the object was already created. */
  markFailed(runId: string, kind: MappingKind, sourceId: string, error: string): IdMapping;

  get(runId: string, kind: MappingKind, sourceId: string): IdMapping | undefined;

  /** Destination ID for a created object, otherwise undefined. */
  getTargetId(runId: string, kind: MappingKind, sourceId: string): string | undefined;

  /** Reverse lookup, used when verifying or rolling back what a run created. */
  getSourceId(runId: string, kind: MappingKind, targetId: string): string | undefined;

  list(runId: string, filter?: MappingFilter): IdMapping[];

  summary(runId: string): IdMapSummary;

  close(): void;
}

export class IdMapConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdMapConflictError';
  }
}

export class IdMapStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdMapStateError';
  }
}
