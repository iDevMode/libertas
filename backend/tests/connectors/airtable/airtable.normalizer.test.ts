import {
  AirtableNormalizer,
  AirtableFieldSummary,
} from '../../../src/connectors/airtable/airtable.normalizer';
import { NormalizedProperty, NormalizedResult } from '../../../src/transformers/interfaces';
import {
  ALL_TABLE_IDS,
  BASE_ID,
  FIELD,
  RECORDS,
  REC,
  TABLE,
  TABLES,
  rawTable,
} from '../../fixtures/airtable/agency-base';

const normalizer = new AirtableNormalizer();

function recordResult(results: NormalizedResult[], recordId: string): NormalizedResult {
  const found = results.find((r) => r.entity.id === recordId);
  if (!found) throw new Error(`No result for ${recordId}`);
  return found;
}

function property(result: NormalizedResult, name: string): NormalizedProperty {
  const found = result.properties.find((p) => p.propertyName === name);
  if (!found) throw new Error(`No property ${name} on ${result.entity.id}`);
  return found;
}

describe('fixture sanity', () => {
  it('uses unique field IDs across the base', () => {
    const ids = TABLES.flatMap((t) => t.fields.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('AirtableNormalizer: table entity', () => {
  const [table] = normalizer.normalizeTable(rawTable(TABLE.tasks));

  it('emits the table first as a database entity', () => {
    expect(table.entity).toMatchObject({
      id: `${BASE_ID}/${TABLE.tasks}`,
      entityType: 'database',
      title: 'Tasks',
      sourcePlatform: 'airtable',
      sourceUrl: `https://airtable.com/${BASE_ID}/${TABLE.tasks}`,
    });
    expect(table.properties).toEqual([]);
  });

  it('does not point at the base, which is not exported as an entity', () => {
    expect(table.entity.parentId).toBeUndefined();
    expect(table.entity.metadata?.baseId).toBe(BASE_ID);
  });

  it('records every field with its type and whether Airtable computes it', () => {
    const fields = table.entity.metadata?.fields as AirtableFieldSummary[];
    expect(fields).toHaveLength(10);
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(byName['Title']).toMatchObject({ propertyType: 'text', computed: false });
    expect(byName['Days left']).toMatchObject({
      airtableType: 'formula',
      computed: true,
      resultType: 'number',
    });
    expect(byName['Client name']).toMatchObject({ propertyType: 'rollup', computed: true });
    expect(byName['Created by']).toMatchObject({ computed: true });
    expect(byName['Tags'].choices).toEqual(['Design', 'Copy', 'Engineering']);
    expect(byName['Project'].linkedDatabaseId).toBe(`${BASE_ID}/${TABLE.projects}`);
  });

  it('stores schema facts the migration planner needs', () => {
    expect(table.entity.metadata).toMatchObject({
      baseId: BASE_ID,
      tableId: TABLE.tasks,
      primaryFieldId: FIELD.taskTitle,
      schemaAvailable: true,
      recordCount: 6,
    });
  });
});

describe('AirtableNormalizer: records', () => {
  const projects = normalizer.normalizeTable(rawTable(TABLE.projects));
  const tasks = normalizer.normalizeTable(rawTable(TABLE.tasks));
  const invoices = normalizer.normalizeTable(rawTable(TABLE.invoices));

  it('emits one record entity per row, titled by the primary field', () => {
    expect(tasks).toHaveLength(1 + RECORDS[TABLE.tasks].length);
    expect(recordResult(tasks, REC.copy).entity).toMatchObject({
      entityType: 'record',
      title: 'Homepage copy',
      parentId: `${BASE_ID}/${TABLE.tasks}`,
      createdAt: new Date('2026-01-13T11:05:00.000Z'),
      sourceUrl: `https://airtable.com/${BASE_ID}/${TABLE.tasks}/${REC.copy}`,
    });
  });

  it('titles records by a formula primary field', () => {
    expect(recordResult(invoices, REC.inv2).entity.title).toBe('INV-002');
  });

  it('normalises plain field types into the right value slots', () => {
    const website = recordResult(projects, REC.website);
    expect(property(website, 'Status')).toMatchObject({
      propertyType: 'select',
      valueText: 'Active',
    });
    expect(property(website, 'Budget')).toMatchObject({
      propertyType: 'number',
      valueNumber: 12500.5,
    });
    expect(property(website, 'Start')).toMatchObject({
      propertyType: 'date',
      valueText: '2026-02-01',
      valueDate: new Date('2026-02-01'),
    });

    const wireframes = recordResult(tasks, REC.wireframes);
    expect(property(wireframes, 'Done')).toMatchObject({
      propertyType: 'boolean',
      valueBoolean: true,
    });
    expect(property(wireframes, 'Hours')).toMatchObject({ valueNumber: 12, valueText: '12' });
  });

  it('keeps multi-selects as a list and as readable text', () => {
    const copy = recordResult(tasks, REC.copy);
    expect(property(copy, 'Tags')).toMatchObject({
      propertyType: 'multi_select',
      valueJson: ['Copy', 'Design'],
      valueText: 'Copy, Design',
    });
  });

  it('keeps the current value of computed fields', () => {
    const wireframes = recordResult(tasks, REC.wireframes);
    expect(property(wireframes, 'Days left')).toMatchObject({
      propertyType: 'formula',
      valueNumber: -3,
    });
    expect(property(wireframes, 'Client name')).toMatchObject({
      propertyType: 'rollup',
      valueJson: ['Acme Ltd'],
      valueText: 'Acme Ltd',
    });
    expect(property(wireframes, 'Created by')).toMatchObject({
      valueText: 'Phil',
      valueJson: { id: 'usrPhil000000001', email: 'owner@example.com', name: 'Phil' },
    });

    const website = recordResult(projects, REC.website);
    expect(property(website, 'Task count')).toMatchObject({
      propertyType: 'rollup',
      valueNumber: 3,
    });
    expect(property(website, 'Total hours')).toMatchObject({ valueNumber: 42.5 });
  });

  it('keeps formula errors visible instead of dropping them', () => {
    const inv3 = recordResult(invoices, REC.inv3);
    expect(property(inv3, 'Amount with VAT')).toMatchObject({
      propertyType: 'formula',
      valueText: '#ERROR!',
      valueJson: { error: '#ERROR!' },
    });
  });

  it('parses dateTime fields', () => {
    const inv1 = recordResult(invoices, REC.inv1);
    expect(property(inv1, 'Issued').valueDate).toEqual(new Date('2026-02-01T12:00:00.000Z'));
  });

  it('omits fields Airtable left empty', () => {
    const launch = recordResult(tasks, REC.launch);
    const names = launch.properties.map((p) => p.propertyName);
    expect(names).not.toContain('Due');
    expect(names).not.toContain('Done');
  });

  it('orders properties by schema position and gives them stable IDs', () => {
    const wireframes = recordResult(tasks, REC.wireframes);
    expect(wireframes.properties.map((p) => p.propertyName)).toEqual([
      'Title',
      'Project',
      'Assignee',
      'Done',
      'Due',
      'Hours',
      'Tags',
      'Days left',
      'Client name',
      'Created by',
    ]);
    expect(property(wireframes, 'Title').id).toBe(`${REC.wireframes}:${FIELD.taskTitle}`);
  });
});

describe('AirtableNormalizer: links', () => {
  const tasks = normalizer.normalizeTable(rawTable(TABLE.tasks));
  const launch = recordResult(tasks, REC.launch);

  it('links every record to its table', () => {
    expect(launch.relations).toContainEqual({
      id: `${REC.launch}:parent`,
      fromEntityId: REC.launch,
      toEntityId: `${BASE_ID}/${TABLE.tasks}`,
      relationType: 'child_of',
    });
  });

  it('turns each linked record into a relation that knows its field and target table', () => {
    const assignees = launch.relations.filter((r) => r.metadata?.propertyName === 'Assignee');
    expect(assignees).toEqual([
      {
        id: `${REC.launch}:${FIELD.taskAssignee}:${REC.ada}`,
        fromEntityId: REC.launch,
        toEntityId: REC.ada,
        relationType: 'related_to',
        metadata: {
          propertyName: 'Assignee',
          fieldId: FIELD.taskAssignee,
          targetDatabaseId: `${BASE_ID}/${TABLE.people}`,
        },
      },
      expect.objectContaining({ toEntityId: REC.linus }),
    ]);
  });

  it('also keeps the linked IDs on the property, for destinations that store them as columns', () => {
    expect(property(launch, 'Assignee')).toMatchObject({
      propertyType: 'relation',
      valueJson: [REC.ada, REC.linus],
    });
  });
});

describe('AirtableNormalizer: attachments', () => {
  const projects = normalizer.normalizeTable(rawTable(TABLE.projects));
  const website = recordResult(projects, REC.website);

  it('emits an attachment per file, flagged as expiring', () => {
    expect(website.attachments).toEqual([
      {
        id: expect.stringMatching(/^att/),
        entityId: REC.website,
        fileName: 'website-brief.pdf',
        fileType: 'application/pdf',
        fileSize: 245_760,
        sourceUrl: expect.stringContaining('website-brief.pdf'),
        metadata: {
          fieldId: FIELD.projectBrief,
          propertyName: 'Brief',
          width: undefined,
          height: undefined,
          sourceUrlExpires: true,
        },
      },
    ]);
  });

  it('keeps a lightweight file list on the property itself', () => {
    expect(property(website, 'Brief')).toMatchObject({
      propertyType: 'file',
      valueText: 'website-brief.pdf',
      valueJson: [expect.objectContaining({ filename: 'website-brief.pdf', size: 245_760 })],
    });
  });
});

describe('AirtableNormalizer: the whole base', () => {
  const results = ALL_TABLE_IDS.flatMap((id) => normalizer.normalizeTable(rawTable(id)));
  const records = results.filter((r) => r.entity.entityType === 'record');
  const recordIds = new Set(records.map((r) => r.entity.id));
  const rawRecords = Object.values(RECORDS).flat();

  it('emits every table and every record exactly once', () => {
    expect(results.filter((r) => r.entity.entityType === 'database')).toHaveLength(5);
    expect(records).toHaveLength(rawRecords.length);
    expect(recordIds.size).toBe(rawRecords.length);
  });

  it('turns every linked record value into exactly one relation', () => {
    const linkFields = new Set(
      TABLES.flatMap((t) =>
        t.fields.filter((f) => f.type === 'multipleRecordLinks').map((f) => f.id)
      )
    );
    const rawLinkCount = rawRecords
      .flatMap((r) => Object.entries(r.fields))
      .filter(([fieldId]) => linkFields.has(fieldId))
      .reduce((sum, [, value]) => sum + (value as string[]).length, 0);

    const links = records
      .flatMap((r) => r.relations)
      .filter((rel) => rel.relationType === 'related_to');
    expect(links).toHaveLength(rawLinkCount);
    expect(links.every((rel) => recordIds.has(rel.toEntityId))).toBe(true);
  });

  it('turns every attachment into exactly one attachment', () => {
    const attachments = records.flatMap((r) => r.attachments);
    expect(attachments.map((a) => a.fileName).sort()).toEqual([
      'INV-001.pdf',
      'INV-002.pdf',
      'acme-logo.png',
      'ada.jpg',
      'website-brief.pdf',
    ]);
  });

  it('produces identical output when run twice, so migrations are repeatable', () => {
    const again = ALL_TABLE_IDS.flatMap((id) => normalizer.normalizeTable(rawTable(id)));
    expect(again).toEqual(results);
  });
});

describe('AirtableNormalizer: degraded inputs', () => {
  it('matches fields keyed by name as well as by ID', () => {
    const raw = rawTable(TABLE.people);
    const data = raw.rawData as {
      records: Array<{ id: string; createdTime: string; fields: Record<string, unknown> }>;
    };
    data.records = [
      {
        id: REC.ada,
        createdTime: '2026-01-02T08:00:00.000Z',
        fields: { Name: 'Ada', Role: 'Designer' },
      },
    ];

    const [, ada] = normalizer.normalizeTable(raw);
    expect(ada.entity.title).toBe('Ada');
    expect(property(ada, 'Role')).toMatchObject({ propertyType: 'select', position: 2 });
  });

  it('infers types from values when the schema is unavailable', () => {
    const results = normalizer.normalizeTable(rawTable(TABLE.tasks, { withSchema: false }));
    const [table] = results;
    const launch = recordResult(results, REC.launch);

    expect(table.entity).toMatchObject({
      title: TABLE.tasks,
      metadata: { schemaAvailable: false },
    });
    expect(launch.entity.title).toBe(REC.launch);
    expect(property(launch, FIELD.taskAssignee)).toMatchObject({ propertyType: 'relation' });
    expect(launch.relations.filter((r) => r.relationType === 'related_to')).toHaveLength(3);
    expect(property(launch, FIELD.taskHours)).toMatchObject({
      propertyType: 'number',
      valueNumber: 22,
    });

    const wireframes = recordResult(results, REC.wireframes);
    expect(property(wireframes, FIELD.taskDone)).toMatchObject({ propertyType: 'boolean' });
    expect(property(wireframes, FIELD.taskTags)).toMatchObject({ propertyType: 'multi_select' });
  });

  it('infers attachments without a schema', () => {
    const results = normalizer.normalizeTable(rawTable(TABLE.projects, { withSchema: false }));
    expect(recordResult(results, REC.website).attachments).toHaveLength(1);
  });

  it('places fields missing from the schema after the known ones', () => {
    const raw = rawTable(TABLE.clients);
    const data = raw.rawData as { records: Array<{ fields: Record<string, unknown> }> };
    data.records = [
      {
        ...RECORDS[TABLE.clients][1],
        fields: { ...RECORDS[TABLE.clients][1].fields, fldNewField000001: 'x' },
      },
    ];

    const [, globex] = normalizer.normalizeTable(raw);
    expect(globex.properties.at(-1)).toMatchObject({
      propertyName: 'fldNewField000001',
      position: 5,
    });
  });

  it('falls back to the record ID when the primary field is empty', () => {
    const raw = rawTable(TABLE.clients);
    const data = raw.rawData as {
      records: Array<{ id: string; createdTime: string; fields: Record<string, unknown> }>;
    };
    data.records = [{ id: REC.acme, createdTime: '2026-01-05T09:00:00.000Z', fields: {} }];

    const [table, acme] = normalizer.normalizeTable(raw);
    expect(acme.entity.title).toBe(REC.acme);
    expect(acme.properties).toEqual([]);
    expect(table.entity.metadata?.recordCount).toBe(1);
  });

  it('handles an empty table', () => {
    const raw = rawTable(TABLE.clients);
    (raw.rawData as { records: unknown[] }).records = [];
    expect(normalizer.normalizeTable(raw)).toHaveLength(1);
  });

  it('rejects extracts without base and table IDs', () => {
    expect(() =>
      normalizer.normalizeTable({
        id: 'x',
        type: 'table',
        rawData: { records: [] },
        extractedAt: new Date(),
      })
    ).toThrow('missing baseId or tableId');
  });

  it('rejects extracts without a records array', () => {
    expect(() =>
      normalizer.normalizeTable({
        id: 'x',
        type: 'table',
        rawData: { baseId: 'a', tableId: 'b' },
        extractedAt: new Date(),
      })
    ).toThrow('no records array');
  });
});
