import Database from 'better-sqlite3';
import {
  IdMapConflictError,
  IdMapping,
  IdMapSummary,
  IIdMapStore,
  MappingFilter,
  MappingKind,
  MappingStatus,
} from './id-map.interfaces.js';
import {
  applyMappingEvent,
  MappingEvent,
  newPendingMapping,
  summarizeMappings,
} from './id-map.transitions.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS id_map (
    run_id     TEXT    NOT NULL,
    kind       TEXT    NOT NULL CHECK (kind IN ('database', 'entity', 'attachment')),
    source_id  TEXT    NOT NULL,
    target_id  TEXT,
    status     TEXT    NOT NULL CHECK (status IN ('pending', 'created', 'failed')),
    error      TEXT,
    attempts   INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT    NOT NULL,
    PRIMARY KEY (run_id, kind, source_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS id_map_target
    ON id_map (run_id, kind, target_id) WHERE target_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS id_map_status ON id_map (run_id, status);
`;

interface IdMapRow {
  run_id: string;
  kind: MappingKind;
  source_id: string;
  target_id: string | null;
  status: MappingStatus;
  error: string | null;
  attempts: number;
  updated_at: string;
}

function fromRow(row: IdMapRow): IdMapping {
  return {
    runId: row.run_id,
    kind: row.kind,
    sourceId: row.source_id,
    targetId: row.target_id ?? undefined,
    status: row.status,
    error: row.error ?? undefined,
    attempts: row.attempts,
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Persistent ID map in a SQLite file, so an interrupted migration can resume
 * and skip everything it already created. Writes are atomic per mapping.
 */
export class SqliteIdMapStore implements IIdMapStore {
  private readonly db: Database.Database;

  constructor(filepath: string) {
    this.db = new Database(filepath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
  }

  reserve(runId: string, kind: MappingKind, sourceId: string): IdMapping {
    const existing = this.get(runId, kind, sourceId);
    if (existing) return existing;
    const mapping = newPendingMapping({ runId, kind, sourceId }, new Date());
    this.upsert(mapping);
    return mapping;
  }

  markCreated(runId: string, kind: MappingKind, sourceId: string, targetId: string): IdMapping {
    return this.apply(runId, kind, sourceId, { type: 'created', targetId });
  }

  markFailed(runId: string, kind: MappingKind, sourceId: string, error: string): IdMapping {
    return this.apply(runId, kind, sourceId, { type: 'failed', error });
  }

  get(runId: string, kind: MappingKind, sourceId: string): IdMapping | undefined {
    const row = this.db
      .prepare('SELECT * FROM id_map WHERE run_id = ? AND kind = ? AND source_id = ?')
      .get(runId, kind, sourceId) as IdMapRow | undefined;
    return row ? fromRow(row) : undefined;
  }

  getTargetId(runId: string, kind: MappingKind, sourceId: string): string | undefined {
    const mapping = this.get(runId, kind, sourceId);
    return mapping?.status === 'created' ? mapping.targetId : undefined;
  }

  getSourceId(runId: string, kind: MappingKind, targetId: string): string | undefined {
    const row = this.db
      .prepare('SELECT source_id FROM id_map WHERE run_id = ? AND kind = ? AND target_id = ?')
      .get(runId, kind, targetId) as { source_id: string } | undefined;
    return row?.source_id;
  }

  list(runId: string, filter: MappingFilter = {}): IdMapping[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM id_map
         WHERE run_id = @runId
           AND (@kind IS NULL OR kind = @kind)
           AND (@status IS NULL OR status = @status)
         ORDER BY kind, source_id`
      )
      .all({ runId, kind: filter.kind ?? null, status: filter.status ?? null }) as IdMapRow[];
    return rows.map(fromRow);
  }

  summary(runId: string): IdMapSummary {
    return summarizeMappings(this.list(runId));
  }

  close(): void {
    this.db.close();
  }

  private apply(
    runId: string,
    kind: MappingKind,
    sourceId: string,
    event: MappingEvent
  ): IdMapping {
    const run = this.db.transaction((): IdMapping => {
      if (event.type === 'created') {
        this.assertTargetFree(runId, kind, sourceId, event.targetId);
      }
      const next = applyMappingEvent(
        { runId, kind, sourceId },
        this.get(runId, kind, sourceId),
        event,
        new Date()
      );
      this.upsert(next);
      return next;
    });
    return run();
  }

  private assertTargetFree(
    runId: string,
    kind: MappingKind,
    sourceId: string,
    targetId: string
  ): void {
    const owner = this.getSourceId(runId, kind, targetId);
    if (owner !== undefined && owner !== sourceId) {
      throw new IdMapConflictError(
        `${kind} target ${targetId} in run ${runId} is already mapped from ${owner}`
      );
    }
  }

  private upsert(mapping: IdMapping): void {
    this.db
      .prepare(
        `INSERT INTO id_map (run_id, kind, source_id, target_id, status, error, attempts, updated_at)
         VALUES (@runId, @kind, @sourceId, @targetId, @status, @error, @attempts, @updatedAt)
         ON CONFLICT (run_id, kind, source_id) DO UPDATE SET
           target_id = excluded.target_id, status = excluded.status, error = excluded.error,
           attempts = excluded.attempts, updated_at = excluded.updated_at`
      )
      .run({
        runId: mapping.runId,
        kind: mapping.kind,
        sourceId: mapping.sourceId,
        targetId: mapping.targetId ?? null,
        status: mapping.status,
        error: mapping.error ?? null,
        attempts: mapping.attempts,
        updatedAt: mapping.updatedAt.toISOString(),
      });
  }
}
