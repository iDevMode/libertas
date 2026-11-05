import {
  displayText,
  inferAirtableFieldType,
  isRecordId,
  normalizeAirtableValue,
} from '../../../src/connectors/airtable/airtable.value-normalizer';
import {
  isComputedAirtableField,
  mapAirtableFieldType,
} from '../../../src/connectors/airtable/airtable.field-types';

describe('mapAirtableFieldType', () => {
  it.each([
    ['singleLineText', 'text'],
    ['phoneNumber', 'phone'],
    ['currency', 'number'],
    ['multipleRecordLinks', 'relation'],
    ['multipleAttachments', 'file'],
    ['multipleLookupValues', 'rollup'],
    ['createdTime', 'date'],
    ['button', 'url'],
  ])('maps %s to %s', (airtableType, expected) => {
    expect(mapAirtableFieldType(airtableType)).toBe(expected);
  });

  it('falls back to text for field types it does not know', () => {
    expect(mapAirtableFieldType('someFutureType')).toBe('text');
  });
});

describe('isComputedAirtableField', () => {
  it('flags fields Airtable calculates', () => {
    expect(
      ['formula', 'rollup', 'count', 'autoNumber', 'lastModifiedBy'].every(isComputedAirtableField)
    ).toBe(true);
  });

  it('does not flag fields people type into', () => {
    expect(['singleLineText', 'multipleRecordLinks', 'date'].some(isComputedAirtableField)).toBe(
      false
    );
  });
});

describe('normalizeAirtableValue', () => {
  it('returns nothing for empty values', () => {
    expect(normalizeAirtableValue(null, 'number')).toEqual({});
    expect(normalizeAirtableValue(undefined, 'singleLineText')).toEqual({});
  });

  it('keeps unparseable dates as text only', () => {
    expect(normalizeAirtableValue('not a date', 'date')).toEqual({ valueText: 'not a date' });
  });

  it('accepts linked records given as objects', () => {
    expect(
      normalizeAirtableValue([{ id: 'recA', name: 'A' }, 'recB'], 'multipleRecordLinks')
    ).toEqual({
      valueJson: ['recA', 'recB'],
      valueText: 'recA, recB',
    });
  });

  it('ignores attachment entries that are not files', () => {
    expect(normalizeAirtableValue([{ nope: true }], 'multipleAttachments')).toEqual({
      valueJson: [],
      valueText: '',
    });
  });

  it('reads the URL of a button, falling back to its label', () => {
    expect(
      normalizeAirtableValue({ label: 'Open', url: 'https://x.test' }, 'button')
    ).toMatchObject({ valueText: 'https://x.test' });
    expect(normalizeAirtableValue({ label: 'Open', url: null }, 'button')).toMatchObject({
      valueText: 'Open',
    });
  });

  it('reads the text of AI and barcode fields', () => {
    expect(
      normalizeAirtableValue({ state: 'generated', value: 'Summary' }, 'aiText')
    ).toMatchObject({ valueText: 'Summary' });
    expect(normalizeAirtableValue({ text: '0123', type: 'upce' }, 'barcode')).toMatchObject({
      valueText: '0123',
    });
    expect(normalizeAirtableValue({ state: 'pending' }, 'aiText')).toEqual({
      valueJson: { state: 'pending' },
    });
  });

  it('handles special numeric formula results', () => {
    expect(normalizeAirtableValue({ specialValue: 'NaN' }, 'formula')).toMatchObject({
      valueText: 'NaN',
    });
  });

  it('serialises objects it cannot describe', () => {
    expect(normalizeAirtableValue({ a: 1 }, 'formula')).toEqual({
      valueJson: { a: 1 },
      valueText: '{"a":1}',
    });
  });
});

describe('displayText', () => {
  it.each([
    [null, ''],
    ['text', 'text'],
    [3, '3'],
    [false, 'false'],
    [['a', ['b', 'c']], 'a, b, c'],
    [{ name: 'Ada', email: 'ada@x.test' }, 'Ada'],
    [{ email: 'ada@x.test' }, 'ada@x.test'],
  ])('renders %j as %j', (value, expected) => {
    expect(displayText(value)).toBe(expected);
  });
});

describe('inferAirtableFieldType', () => {
  it.each([
    [['recAAAAAAAAAAAAAA', 'recBBBBBBBBBBBBBB'], 'multipleRecordLinks'],
    [[{ id: 'att1', url: 'https://x', filename: 'a.pdf' }], 'multipleAttachments'],
    [['Design', 'Copy'], 'multipleSelects'],
    [[1, 2], 'multipleLookupValues'],
    [4, 'number'],
    [true, 'checkbox'],
    ['hello', 'singleLineText'],
    [[], 'singleLineText'],
  ])('infers %j as %s', (value, expected) => {
    expect(inferAirtableFieldType(value)).toBe(expected);
  });
});

describe('isRecordId', () => {
  it('accepts Airtable record IDs only', () => {
    expect(isRecordId('recAAAAAAAAAAAAAA')).toBe(true);
    expect(isRecordId('recShort')).toBe(false);
    expect(isRecordId('tblAAAAAAAAAAAAAA')).toBe(false);
    expect(isRecordId(42)).toBe(false);
  });
});
