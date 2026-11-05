import { AirtableNormalizer } from '../../src/connectors/airtable/airtable.normalizer';
import { MemoryIdMapStore, resolveRelations } from '../../src/migration';
import { ALL_TABLE_IDS, REC, rawTable } from '../fixtures/airtable/agency-base';

const RUN = 'run-1';
const results = ALL_TABLE_IDS.flatMap((id) =>
  new AirtableNormalizer().normalizeTable(rawTable(id))
);
const records = results.filter((r) => r.entity.entityType === 'record');
const relations = records.flatMap((r) => r.relations);
const links = relations.filter((r) => r.relationType === 'related_to');

/** Simulates a destination writer: every record gets a destination page ID. */
function createAll(store: MemoryIdMapStore, except: string[] = []): void {
  for (const { entity } of records) {
    if (except.includes(entity.id)) store.markFailed(RUN, 'entity', entity.id, 'write failed');
    else store.markCreated(RUN, 'entity', entity.id, `page-${entity.id}`);
  }
}

describe('resolveRelations', () => {
  it('rebuilds every link once all records exist in the destination', () => {
    const store = new MemoryIdMapStore();
    createAll(store);

    const { resolved, unresolved } = resolveRelations(relations, store, RUN);

    expect(unresolved).toEqual([]);
    expect(resolved).toHaveLength(links.length);
    expect(resolved).toContainEqual({
      relationId: expect.stringContaining(REC.ada),
      fromEntityId: REC.launch,
      toEntityId: REC.ada,
      fromTargetId: `page-${REC.launch}`,
      toTargetId: `page-${REC.ada}`,
      relationType: 'related_to',
      propertyName: 'Assignee',
    });
  });

  it('skips structural child_of relations by default', () => {
    const store = new MemoryIdMapStore();
    createAll(store);
    const childOf = relations.filter((r) => r.relationType === 'child_of');

    expect(childOf.length).toBeGreaterThan(0);
    expect(resolveRelations(childOf, store, RUN)).toEqual({ resolved: [], unresolved: [] });
  });

  it('reports which end is missing when a record failed to write', () => {
    const store = new MemoryIdMapStore();
    createAll(store, [REC.ada]);

    const { resolved, unresolved } = resolveRelations(relations, store, RUN);
    const adaLinks = links.filter((l) => l.fromEntityId === REC.ada || l.toEntityId === REC.ada);

    expect(unresolved).toHaveLength(adaLinks.length);
    expect(resolved).toHaveLength(links.length - adaLinks.length);
    expect(unresolved.find((u) => u.fromEntityId === REC.ada)?.missing).toBe('from');
    expect(unresolved.find((u) => u.toEntityId === REC.ada)).toMatchObject({
      missing: 'to',
      propertyName: 'Assignee',
    });
  });

  it('reports both ends missing when nothing has been created', () => {
    const { resolved, unresolved } = resolveRelations(
      links.slice(0, 1),
      new MemoryIdMapStore(),
      RUN
    );
    expect(resolved).toEqual([]);
    expect(unresolved[0].missing).toBe('both');
  });

  it('can resolve structural relations when asked to', () => {
    const store = new MemoryIdMapStore();
    const [first] = records;
    store.markCreated(RUN, 'entity', first.entity.id, 'page-1');
    store.markCreated(RUN, 'entity', first.entity.parentId!, 'db-1');

    const { resolved } = resolveRelations(first.relations, store, RUN, ['child_of']);
    expect(resolved).toEqual([
      expect.objectContaining({
        fromTargetId: 'page-1',
        toTargetId: 'db-1',
        relationType: 'child_of',
      }),
    ]);
  });
});
