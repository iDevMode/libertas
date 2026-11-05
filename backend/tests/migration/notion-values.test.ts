import { FieldPlan } from '../../src/migration';
import {
  relationValue,
  toPropertyValue,
  toRichText,
  toSchemaConfig,
} from '../../src/migration/notion/notion-values';
import { NormalizedProperty } from '../../src/transformers/interfaces';

const field = (targetType: FieldPlan['targetType'], extra: Partial<FieldPlan> = {}): FieldPlan => ({
  sourceFieldId: 'f',
  sourceName: 'F',
  sourceType: 'x',
  targetName: 'F',
  targetType,
  lossy: false,
  ...extra,
});

const prop = (values: Partial<NormalizedProperty>): NormalizedProperty => ({
  id: 'p',
  entityId: 'e',
  propertyName: 'F',
  propertyType: 'text',
  position: 0,
  ...values,
});

describe('toSchemaConfig', () => {
  it('builds the schema object for each property type', () => {
    expect(toSchemaConfig(field('title'))).toEqual({ type: 'title', title: {} });
    expect(toSchemaConfig(field('number'))).toEqual({
      type: 'number',
      number: { format: 'number' },
    });
    expect(toSchemaConfig(field('number', { numberFormat: 'percent' }))).toEqual({
      type: 'number',
      number: { format: 'percent' },
    });
    expect(toSchemaConfig(field('select', { options: ['A', 'B'] }))).toEqual({
      type: 'select',
      select: { options: [{ name: 'A' }, { name: 'B' }] },
    });
    expect(toSchemaConfig(field('files'))).toEqual({ type: 'files', files: {} });
  });

  it('only builds a relation once its target data source exists', () => {
    expect(toSchemaConfig(field('relation'))).toBeUndefined();
    expect(toSchemaConfig(field('relation'), 'ds-1')).toEqual({
      type: 'relation',
      relation: { data_source_id: 'ds-1', type: 'single_property', single_property: {} },
    });
  });

  it('builds nothing for fields left out of the migration', () => {
    expect(toSchemaConfig(field(null))).toBeUndefined();
  });
});

describe('toRichText', () => {
  it('splits text into 2,000-character pieces', () => {
    const items = toRichText('x'.repeat(4500));
    expect(items.map((i) => i.text.content.length)).toEqual([2000, 2000, 500]);
  });

  it("stops at Notion's 100-piece limit", () => {
    expect(toRichText('x'.repeat(2000 * 101))).toHaveLength(100);
  });

  it('returns nothing for empty text', () => {
    expect(toRichText('')).toEqual([]);
  });
});

describe('toPropertyValue', () => {
  it('writes text, titles and selects', () => {
    expect(toPropertyValue(field('rich_text'), prop({ valueText: 'hi' }))).toEqual({
      rich_text: [{ type: 'text', text: { content: 'hi' } }],
    });
    expect(toPropertyValue(field('title'), prop({ valueText: 'T' }))).toEqual({
      title: [{ type: 'text', text: { content: 'T' } }],
    });
    expect(toPropertyValue(field('select'), prop({ valueText: 'A, B' }))).toEqual({
      select: { name: 'A B' },
    });
    expect(toPropertyValue(field('rich_text'), prop({}))).toBeUndefined();
  });

  it('writes numbers, reading text when needed and skipping non-numbers', () => {
    expect(toPropertyValue(field('number'), prop({ valueNumber: 3 }))).toEqual({ number: 3 });
    expect(toPropertyValue(field('number'), prop({ valueText: '4.5' }))).toEqual({ number: 4.5 });
    expect(toPropertyValue(field('number'), prop({ valueText: '#ERROR!' }))).toBeUndefined();
    expect(toPropertyValue(field('number'), prop({}))).toBeUndefined();
  });

  it('writes multi-selects from a list or from text', () => {
    expect(toPropertyValue(field('multi_select'), prop({ valueJson: ['A', 'a', 'B'] }))).toEqual({
      multi_select: [{ name: 'A' }, { name: 'B' }],
    });
    expect(toPropertyValue(field('multi_select'), prop({ valueText: 'X, Y' }))).toEqual({
      multi_select: [{ name: 'X' }, { name: 'Y' }],
    });
    expect(toPropertyValue(field('multi_select'), prop({ valueJson: [] }))).toBeUndefined();
  });

  it('writes dates as given and skips invalid ones', () => {
    expect(toPropertyValue(field('date'), prop({ valueText: '2026-02-01' }))).toEqual({
      date: { start: '2026-02-01' },
    });
    expect(
      toPropertyValue(field('date'), prop({ valueDate: new Date('2026-02-01T12:00:00Z') }))
    ).toEqual({
      date: { start: '2026-02-01T12:00:00.000Z' },
    });
    expect(toPropertyValue(field('date'), prop({ valueText: 'soon' }))).toBeUndefined();
    expect(toPropertyValue(field('date'), prop({}))).toBeUndefined();
  });

  it('writes checkboxes', () => {
    expect(toPropertyValue(field('checkbox'), prop({ valueBoolean: true }))).toEqual({
      checkbox: true,
    });
    expect(toPropertyValue(field('checkbox'), prop({ valueText: 'false' }))).toEqual({
      checkbox: false,
    });
  });

  it("writes links, emails and phone numbers within Notion's length limits", () => {
    expect(toPropertyValue(field('url'), prop({ valueText: 'https://x.test' }))).toEqual({
      url: 'https://x.test',
    });
    expect(
      toPropertyValue(field('url'), prop({ valueText: 'https://x.test/' + 'a'.repeat(2000) }))
    ).toBeUndefined();
    expect(toPropertyValue(field('email'), prop({ valueText: 'a@b.test' }))).toEqual({
      email: 'a@b.test',
    });
    expect(toPropertyValue(field('phone_number'), prop({ valueText: '+44 20' }))).toEqual({
      phone_number: '+44 20',
    });
  });

  it('leaves relations and files to later steps', () => {
    expect(toPropertyValue(field('relation'), prop({ valueJson: ['rec1'] }))).toBeUndefined();
    expect(toPropertyValue(field('files'), prop({ valueText: 'a.pdf' }))).toBeUndefined();
  });
});

describe('relationValue', () => {
  it('lists page IDs', () => {
    expect(relationValue(['p1', 'p2'])).toEqual({ relation: [{ id: 'p1' }, { id: 'p2' }] });
  });
});
