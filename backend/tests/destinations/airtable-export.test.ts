import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AirtableNormalizer } from '../../src/connectors/airtable/airtable.normalizer';
import { IDestinationAdapter, WriteResult } from '../../src/destinations/interfaces';
import { SQLiteAdapter } from '../../src/destinations/sqlite.adapter';
import {
  RelationalSQLiteAdapter,
  convertToRelationalSchema,
} from '../../src/destinations/relational-sqlite.adapter';
import { NormalizedRelation, NormalizedResult } from '../../src/transformers/interfaces';
import {
  ALL_TABLE_IDS,
  BASE_ID,
  RECORDS,
  REC,
  TABLE,
  TABLES,
  rawTable,
} from '../fixtures/airtable/agency-base';
import { mapAirtableFieldType } from '../../src/connectors/airtable/airtable.field-types';

/**
 * End-to-end check that a normalised Airtable base can be written by the existing
 * SQLite exporters, mirroring what the export worker does per extracted table.
 */
let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'libertas-airtable-export-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Same order as the export worker: entities and properties per table, links at the end. */
async function exportBase(
  adapter: IDestinationAdapter,
  extraRelations: NormalizedRelation[] = []
): Promise<WriteResult> {
  await adapter.createSchema();
  const transaction = await adapter.beginTransaction();
  const relations: NormalizedRelation[] = [...extraRelations];
  for (const tableId of ALL_TABLE_IDS) {
    const results: NormalizedResult[] = new AirtableNormalizer().normalizeTable(rawTable(tableId));
    await adapter.writeEntities(results.map((r) => r.entity));
    await adapter.writeProperties(results.flatMap((r) => r.properties));
    relations.push(...results.flatMap((r) => r.relations));
    await adapter.writeContentBlocks(results.flatMap((r) => r.contentBlocks));
    await adapter.writeAttachments(results.flatMap((r) => r.attachments));
  }
  const relationResult = await adapter.writeRelations(relations);
  await adapter.commit(transaction);
  await adapter.disconnect();
  return relationResult;
}

const recordCount = Object.values(RECORDS).flat().length;

describe('exporting the Airtable base to SQLite', () => {
  it('writes every table, record, link and file to the universal schema', async () => {
    const filepath = join(dir, 'universal.db');
    const adapter = new SQLiteAdapter();
    await adapter.connect({ type: 'sqlite', filepath });
    const relationResult = await exportBase(adapter);
    expect(relationResult.failed).toBe(0);

    const db = new Database(filepath, { readonly: true });
    const count = (sql: string): number => (db.prepare(sql).get() as { n: number }).n;

    expect(count("SELECT COUNT(*) AS n FROM entities WHERE entity_type = 'record'")).toBe(
      recordCount
    );
    expect(count("SELECT COUNT(*) AS n FROM entities WHERE entity_type = 'database'")).toBe(5);
    expect(count('SELECT COUNT(*) AS n FROM attachments')).toBe(5);
    expect(count("SELECT COUNT(*) AS n FROM relations WHERE relation_type = 'child_of'")).toBe(
      recordCount
    );
    expect(
      count("SELECT COUNT(*) AS n FROM relations WHERE relation_type = 'related_to'")
    ).toBeGreaterThan(0);

    const status = db
      .prepare('SELECT value_text FROM properties WHERE entity_id = ? AND property_name = ?')
      .get(REC.website, 'Status') as { value_text: string };
    expect(status.value_text).toBe('Active');
    db.close();
  });

  it('skips and reports a link to a record outside the export instead of failing', async () => {
    const adapter = new SQLiteAdapter();
    await adapter.connect({ type: 'sqlite', filepath: join(dir, 'dangling.db') });
    const dangling: NormalizedRelation = {
      id: 'dangling-link',
      fromEntityId: REC.ada,
      toEntityId: 'recNotExported0001',
      relationType: 'related_to',
    };

    const relationResult = await exportBase(adapter, [dangling]);

    expect(relationResult.failed).toBe(1);
    expect(relationResult.errors?.[0].id).toBe('dangling-link');
  });

  it('writes one SQL table per Airtable table, with links as columns', async () => {
    const filepath = join(dir, 'relational.db');
    const adapter = new RelationalSQLiteAdapter();
    adapter.setDatabaseSchemas(
      TABLES.map((table) =>
        convertToRelationalSchema(
          `${BASE_ID}/${table.id}`,
          table.name,
          table.fields.map((field) => ({
            id: field.id,
            name: field.name,
            type: mapAirtableFieldType(field.type),
            relationTargetDatabaseId: field.options?.linkedTableId
              ? `${BASE_ID}/${field.options.linkedTableId}`
              : undefined,
          }))
        )
      )
    );
    await adapter.connect({ type: 'relational_sqlite', filepath });
    await exportBase(adapter);

    const db = new Database(filepath, { readonly: true });
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at').all() as Array<
      Record<string, unknown>
    >;
    expect(tasks).toHaveLength(RECORDS[TABLE.tasks].length);
    expect(tasks[0]).toMatchObject({
      title: 'Wireframes',
      hours: 12,
      done: 1,
      project: REC.website,
    });
    expect((db.prepare('SELECT COUNT(*) AS n FROM invoices').get() as { n: number }).n).toBe(3);
    db.close();
  });

  it('keeps a row whose link points outside the export, clearing only that link', async () => {
    const filepath = join(dir, 'relational-dangling.db');
    const adapter = new RelationalSQLiteAdapter();
    adapter.setDatabaseSchemas([
      convertToRelationalSchema('db-people', 'People', [{ id: 'p1', name: 'Name', type: 'text' }]),
      convertToRelationalSchema('db-tasks', 'Tasks', [
        { id: 't1', name: 'Hours', type: 'number' },
        { id: 't2', name: 'Owner', type: 'relation', relationTargetDatabaseId: 'db-people' },
      ]),
    ]);
    await adapter.connect({ type: 'relational_sqlite', filepath });
    await adapter.createSchema();
    const transaction = await adapter.beginTransaction();
    await adapter.writeEntities([
      {
        id: 'task-1',
        entityType: 'record',
        title: 'Orphan task',
        parentId: 'db-tasks',
        sourcePlatform: 'airtable',
      },
    ]);
    await adapter.writeProperties([
      {
        id: 'a',
        entityId: 'task-1',
        propertyName: 'Hours',
        propertyType: 'number',
        valueNumber: 3,
        position: 0,
      },
      {
        id: 'b',
        entityId: 'task-1',
        propertyName: 'Owner',
        propertyType: 'relation',
        valueJson: ['person-gone'],
        position: 1,
      },
    ]);
    await adapter.commit(transaction);
    await adapter.disconnect();

    const db = new Database(filepath, { readonly: true });
    expect(db.prepare('SELECT title, hours, owner FROM tasks').get()).toEqual({
      title: 'Orphan task',
      hours: 3,
      owner: null,
    });
    db.close();
  });
});
