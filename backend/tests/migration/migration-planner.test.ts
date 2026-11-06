import { AirtableNormalizer } from '../../src/connectors/airtable/airtable.normalizer';
import { buildMigrationPlan, FieldPlan, TablePlan } from '../../src/migration';
import { NormalizedResult } from '../../src/transformers/interfaces';
import { ALL_TABLE_IDS, BASE_ID, TABLE, rawTable } from '../fixtures/airtable/agency-base';

const normalize = (ids: string[], withSchema = true): NormalizedResult[] =>
  ids.flatMap((id) => new AirtableNormalizer().normalizeTable(rawTable(id, { withSchema })));

const plan = buildMigrationPlan(normalize(ALL_TABLE_IDS));

function table(name: string): TablePlan {
  const found = plan.tables.find((t) => t.name === name);
  if (!found) throw new Error(`No table ${name}`);
  return found;
}

function field(tableName: string, sourceName: string): FieldPlan {
  const found = table(tableName).fields.find((f) => f.sourceName === sourceName);
  if (!found) throw new Error(`No field ${sourceName}`);
  return found;
}

describe('buildMigrationPlan', () => {
  it('plans one Notion database per Airtable table', () => {
    expect(plan.sourcePlatform).toBe('airtable');
    expect(plan.tables.map((t) => [t.name, t.recordCount])).toEqual([
      ['Clients', 2],
      ['Projects', 3],
      ['Tasks', 6],
      ['People', 3],
      ['Invoices', 3],
    ]);
  });

  it('makes the primary field the Notion title, first in the list', () => {
    expect(table('Tasks').fields[0]).toMatchObject({
      sourceName: 'Title',
      targetType: 'title',
      lossy: false,
    });
  });

  it('warns when the title comes from a formula', () => {
    expect(field('Invoices', 'Reference')).toMatchObject({ targetType: 'title', lossy: true });
  });

  it('maps editable fields to their Notion equivalents', () => {
    expect(field('Tasks', 'Due')).toMatchObject({ targetType: 'date', lossy: false });
    expect(field('Tasks', 'Done')).toMatchObject({ targetType: 'checkbox' });
    expect(field('Tasks', 'Hours')).toMatchObject({ targetType: 'number' });
    expect(field('Tasks', 'Tags')).toMatchObject({
      targetType: 'multi_select',
      options: ['Design', 'Copy', 'Engineering'],
    });
    expect(field('Projects', 'Status')).toMatchObject({
      targetType: 'select',
      options: ['Planning', 'Active', 'Done'],
    });
    expect(field('Clients', 'Email')).toMatchObject({ targetType: 'email' });
  });

  it('turns linked-record fields into relations to the planned table', () => {
    expect(field('Tasks', 'Assignee')).toMatchObject({
      targetType: 'relation',
      relationTargetDatabaseId: `${BASE_ID}/${TABLE.people}`,
      lossy: false,
    });
  });

  it('copies calculated fields as fixed values, keeping numbers numeric', () => {
    expect(field('Tasks', 'Days left')).toMatchObject({ targetType: 'number', lossy: true });
    expect(field('Tasks', 'Client name')).toMatchObject({ targetType: 'rich_text', lossy: true });
    expect(field('Projects', 'Task count')).toMatchObject({ targetType: 'number', lossy: true });
    expect(field('Invoices', 'Amount with VAT')).toMatchObject({
      targetType: 'number',
      lossy: true,
    });
    expect(field('Tasks', 'Created by')).toMatchObject({ targetType: 'rich_text', lossy: true });
  });

  it('plans file fields but flags that files are not copied yet', () => {
    expect(field('Projects', 'Brief')).toMatchObject({ targetType: 'files', lossy: true });
    expect(field('Projects', 'Budget')).toMatchObject({ targetType: 'number', lossy: true });
  });

  it('lists every lossy field as a warning to approve', () => {
    expect(plan.warnings).toContainEqual({
      table: 'Tasks',
      field: 'Days left',
      message: expect.stringContaining('fixed value'),
    });
    expect(plan.warnings.every((w) => w.message.length > 0)).toBe(true);
  });

  it('adds a source-ID property to every table', () => {
    expect(plan.tables.every((t) => t.sourceIdPropertyName === 'Airtable record ID')).toBe(true);
  });

  it('drops links to tables outside the migration, with a warning', () => {
    const partial = buildMigrationPlan(normalize([TABLE.tasks, TABLE.projects]));
    const assignee = partial.tables
      .find((t) => t.name === 'Tasks')!
      .fields.find((f) => f.sourceName === 'Assignee');
    expect(assignee).toMatchObject({ targetType: null, lossy: true });
    expect(partial.warnings).toContainEqual(
      expect.objectContaining({
        field: 'Assignee',
        message: expect.stringContaining('not part of this migration'),
      })
    );
  });

  it('uses a placeholder title when the table schema was unavailable', () => {
    const noSchema = buildMigrationPlan(normalize([TABLE.tasks], false));
    expect(noSchema.tables[0].fields[0]).toMatchObject({
      targetName: 'Name',
      targetType: 'title',
      lossy: true,
    });
  });

  it('ignores entities that are not Airtable tables', () => {
    const notion: NormalizedResult = {
      entity: { id: 'n', entityType: 'database', title: 'Notion DB', sourcePlatform: 'notion' },
      properties: [],
      relations: [],
      contentBlocks: [],
      attachments: [],
    };
    expect(buildMigrationPlan([notion]).tables).toEqual([]);
  });
});

describe('buildMigrationPlan: names and options Notion would reject', () => {
  function planFor(fields: Array<Record<string, unknown>>): TablePlan {
    const result: NormalizedResult = {
      entity: {
        id: 'app/tbl',
        entityType: 'database',
        title: 'T',
        sourcePlatform: 'airtable',
        metadata: { primaryFieldId: 'f1', recordCount: 0, fields },
      },
      properties: [],
      relations: [],
      contentBlocks: [],
      attachments: [],
    };
    return buildMigrationPlan([result]).tables[0];
  }
  const base = { propertyType: 'text', computed: false };

  it('keeps property names unique regardless of case, and away from the source-ID property', () => {
    const t = planFor([
      { ...base, id: 'f1', name: 'Name', airtableType: 'singleLineText' },
      { ...base, id: 'f2', name: 'name', airtableType: 'singleLineText' },
      { ...base, id: 'f3', name: 'Airtable record ID', airtableType: 'singleLineText' },
    ]);
    expect(t.fields.map((f) => f.targetName)).toEqual(['Name', 'name (2)', 'Airtable record ID']);
    expect(t.sourceIdPropertyName).toBe('Airtable record ID (2)');
  });

  it('removes commas from options and drops duplicates', () => {
    const t = planFor([
      { ...base, id: 'f1', name: 'Name', airtableType: 'singleLineText' },
      {
        ...base,
        id: 'f2',
        name: 'Size',
        airtableType: 'singleSelect',
        choices: ['Small, light', 'small  light', 'Large'],
      },
    ]);
    expect(t.fields[1].options).toEqual(['Small light', 'Large']);
  });

  it('copies unknown field types as text, with a warning', () => {
    const t = planFor([
      { ...base, id: 'f1', name: 'Name', airtableType: 'singleLineText' },
      { ...base, id: 'f2', name: 'Mystery', airtableType: 'futureType' },
    ]);
    expect(t.fields[1]).toMatchObject({
      targetType: 'rich_text',
      lossy: true,
      note: expect.stringContaining('futureType'),
    });
  });

  it('keeps percent formulas as percentages', () => {
    const t = planFor([
      { ...base, id: 'f1', name: 'Name', airtableType: 'singleLineText' },
      { ...base, id: 'f2', name: 'Margin', airtableType: 'formula', resultType: 'percent' },
      { ...base, id: 'f3', name: 'Rate', airtableType: 'percent' },
    ]);
    expect(t.fields[1]).toMatchObject({ targetType: 'number', numberFormat: 'percent' });
    expect(t.fields[2]).toMatchObject({
      targetType: 'number',
      numberFormat: 'percent',
      lossy: false,
    });
  });
});
