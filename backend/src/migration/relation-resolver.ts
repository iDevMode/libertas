import { RelationType } from '../common/types.js';
import { NormalizedRelation } from '../transformers/interfaces.js';
import { IIdMapStore } from './id-map.interfaces.js';

/** A source link whose both ends now exist in the destination. */
export interface ResolvedLink {
  relationId: string;
  fromTargetId: string;
  toTargetId: string;
  relationType: RelationType;
  propertyName?: string;
}

/** A source link that cannot be written yet, and which end is missing. */
export interface UnresolvedLink {
  relationId: string;
  fromEntityId: string;
  toEntityId: string;
  missing: 'from' | 'to' | 'both';
  propertyName?: string;
}

export interface RelationResolution {
  resolved: ResolvedLink[];
  unresolved: UnresolvedLink[];
}

/**
 * Structural relations (child_of, parent_of) are expressed by where a record is created,
 * so by default only user-visible links are resolved.
 */
const DEFAULT_LINK_TYPES: RelationType[] = ['related_to', 'linked_to', 'mentions', 'assigned_to'];

/**
 * Translates source relations into destination IDs using the run's ID map.
 * Run this after all records are created: anything still unresolved is either a link to a
 * record outside the migration or a record that failed, and both belong in the integrity report.
 */
export function resolveRelations(
  relations: NormalizedRelation[],
  store: IIdMapStore,
  runId: string,
  linkTypes: RelationType[] = DEFAULT_LINK_TYPES
): RelationResolution {
  const result: RelationResolution = { resolved: [], unresolved: [] };

  for (const relation of relations) {
    if (!linkTypes.includes(relation.relationType)) continue;

    const fromTargetId = store.getTargetId(runId, 'entity', relation.fromEntityId);
    const toTargetId = store.getTargetId(runId, 'entity', relation.toEntityId);
    const propertyName = readPropertyName(relation);

    if (fromTargetId && toTargetId) {
      result.resolved.push({
        relationId: relation.id,
        fromTargetId,
        toTargetId,
        relationType: relation.relationType,
        propertyName,
      });
    } else {
      result.unresolved.push({
        relationId: relation.id,
        fromEntityId: relation.fromEntityId,
        toEntityId: relation.toEntityId,
        missing: !fromTargetId && !toTargetId ? 'both' : fromTargetId ? 'to' : 'from',
        propertyName,
      });
    }
  }

  return result;
}

function readPropertyName(relation: NormalizedRelation): string | undefined {
  const name = relation.metadata?.propertyName;
  return typeof name === 'string' ? name : undefined;
}
