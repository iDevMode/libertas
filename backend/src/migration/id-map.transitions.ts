import {
  IdMapConflictError,
  IdMapping,
  IdMapStateError,
  IdMapSummary,
  MappingKind,
  MappingStatus,
  StatusCounts,
} from './id-map.interfaces.js';

/**
 * State rules shared by every ID map store, so in-memory and persistent stores
 * behave identically:
 *   (none | pending | failed) --created--> created
 *   (none | pending | failed) --failed--->  failed
 *   created --created (same target)-->      created (no-op)
 *   created --created (other target)-->     conflict
 *   created --failed-->                     state error
 */

export type MappingEvent =
  | { type: 'created'; targetId: string }
  | { type: 'failed'; error: string };

interface MappingKey {
  runId: string;
  kind: MappingKind;
  sourceId: string;
}

export function newPendingMapping(key: MappingKey, now: Date): IdMapping {
  return { ...key, status: 'pending', attempts: 0, updatedAt: now };
}

export function applyMappingEvent(
  key: MappingKey,
  existing: IdMapping | undefined,
  event: MappingEvent,
  now: Date
): IdMapping {
  const current = existing ?? newPendingMapping(key, now);
  const label = `${key.kind} ${key.sourceId} in run ${key.runId}`;

  if (event.type === 'created') {
    if (current.status === 'created') {
      if (current.targetId === event.targetId) return current;
      throw new IdMapConflictError(
        `${label} is already mapped to ${current.targetId}, not ${event.targetId}`
      );
    }
    return {
      ...current,
      status: 'created',
      targetId: event.targetId,
      error: undefined,
      attempts: current.attempts + 1,
      updatedAt: now,
    };
  }

  if (current.status === 'created') {
    throw new IdMapStateError(`${label} was already created as ${current.targetId}`);
  }
  return {
    ...current,
    status: 'failed',
    error: event.error,
    attempts: current.attempts + 1,
    updatedAt: now,
  };
}

function emptyCounts(): StatusCounts {
  return { pending: 0, created: 0, failed: 0 };
}

export function summarizeMappings(mappings: IdMapping[]): IdMapSummary {
  const summary: IdMapSummary = { total: 0, byStatus: emptyCounts(), byKind: {} };
  for (const mapping of mappings) {
    summary.total++;
    summary.byStatus[mapping.status]++;
    const kindCounts = summary.byKind[mapping.kind] ?? emptyCounts();
    kindCounts[mapping.status as MappingStatus]++;
    summary.byKind[mapping.kind] = kindCounts;
  }
  return summary;
}
