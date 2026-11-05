import {
  IdMapConflictError,
  IdMapping,
  IdMapSummary,
  IIdMapStore,
  MappingFilter,
  MappingKind,
} from './id-map.interfaces.js';
import {
  applyMappingEvent,
  MappingEvent,
  newPendingMapping,
  summarizeMappings,
} from './id-map.transitions.js';

const keyOf = (runId: string, kind: MappingKind, id: string): string =>
  `${runId}\u0000${kind}\u0000${id}`;

/**
 * In-memory ID map for dry runs and tests. Nothing survives the process,
 * so real migrations use SqliteIdMapStore to be resumable.
 */
export class MemoryIdMapStore implements IIdMapStore {
  private readonly bySource = new Map<string, IdMapping>();
  private readonly byTarget = new Map<string, string>();

  reserve(runId: string, kind: MappingKind, sourceId: string): IdMapping {
    const key = keyOf(runId, kind, sourceId);
    const existing = this.bySource.get(key);
    if (existing) return { ...existing };

    const mapping = newPendingMapping({ runId, kind, sourceId }, new Date());
    this.bySource.set(key, mapping);
    return { ...mapping };
  }

  markCreated(runId: string, kind: MappingKind, sourceId: string, targetId: string): IdMapping {
    const owner = this.getSourceId(runId, kind, targetId);
    if (owner !== undefined && owner !== sourceId) {
      throw new IdMapConflictError(
        `${kind} target ${targetId} in run ${runId} is already mapped from ${owner}`
      );
    }
    const mapping = this.apply(runId, kind, sourceId, { type: 'created', targetId });
    this.byTarget.set(keyOf(runId, kind, targetId), sourceId);
    return mapping;
  }

  markFailed(runId: string, kind: MappingKind, sourceId: string, error: string): IdMapping {
    return this.apply(runId, kind, sourceId, { type: 'failed', error });
  }

  get(runId: string, kind: MappingKind, sourceId: string): IdMapping | undefined {
    const mapping = this.bySource.get(keyOf(runId, kind, sourceId));
    return mapping ? { ...mapping } : undefined;
  }

  getTargetId(runId: string, kind: MappingKind, sourceId: string): string | undefined {
    const mapping = this.bySource.get(keyOf(runId, kind, sourceId));
    return mapping?.status === 'created' ? mapping.targetId : undefined;
  }

  getSourceId(runId: string, kind: MappingKind, targetId: string): string | undefined {
    return this.byTarget.get(keyOf(runId, kind, targetId));
  }

  list(runId: string, filter: MappingFilter = {}): IdMapping[] {
    return [...this.bySource.values()]
      .filter((m) => m.runId === runId)
      .filter((m) => !filter.kind || m.kind === filter.kind)
      .filter((m) => !filter.status || m.status === filter.status)
      .map((m) => ({ ...m }));
  }

  summary(runId: string): IdMapSummary {
    return summarizeMappings(this.list(runId));
  }

  close(): void {
    this.bySource.clear();
    this.byTarget.clear();
  }

  private apply(
    runId: string,
    kind: MappingKind,
    sourceId: string,
    event: MappingEvent
  ): IdMapping {
    const key = keyOf(runId, kind, sourceId);
    const next = applyMappingEvent(
      { runId, kind, sourceId },
      this.bySource.get(key),
      event,
      new Date()
    );
    this.bySource.set(key, next);
    return { ...next };
  }
}
