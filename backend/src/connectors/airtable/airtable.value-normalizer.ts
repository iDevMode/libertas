import { AirtableAttachment } from './airtable.types.js';

/** The value slots of a NormalizedProperty. valueText is always set when a value exists. */
export interface PropertyValues {
  valueText?: string;
  valueNumber?: number;
  valueDate?: Date;
  valueBoolean?: boolean;
  valueJson?: unknown;
}

const RECORD_ID_PATTERN = /^rec[A-Za-z0-9]{14}$/;
const DATE_FIELD_TYPES = new Set(['date', 'dateTime', 'createdTime', 'lastModifiedTime']);

export function isRecordId(value: unknown): value is string {
  return typeof value === 'string' && RECORD_ID_PATTERN.test(value);
}

export function isAttachment(value: unknown): value is AirtableAttachment {
  return isObject(value) && typeof value.url === 'string' && typeof value.filename === 'string';
}

/**
 * Guesses the Airtable field type from a value, for tables read without schema access.
 */
export function inferAirtableFieldType(value: unknown): string {
  if (Array.isArray(value) && value.length > 0) {
    if (value.every(isRecordId)) return 'multipleRecordLinks';
    if (value.every(isAttachment)) return 'multipleAttachments';
    if (value.every((item) => typeof item === 'string')) return 'multipleSelects';
    return 'multipleLookupValues';
  }
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'checkbox';
  return 'singleLineText';
}

/**
 * Converts one Airtable cell into universal property values.
 * Typed handling covers fields whose JSON shape needs interpreting; everything else
 * is mapped by its runtime type so computed fields (formulas, rollups) keep their value.
 */
export function normalizeAirtableValue(value: unknown, fieldType: string): PropertyValues {
  if (value === null || value === undefined) return {};

  if (DATE_FIELD_TYPES.has(fieldType) && typeof value === 'string') {
    return dateValues(value);
  }

  switch (fieldType) {
    case 'multipleRecordLinks':
      return linkValues(value);
    case 'multipleAttachments':
      return attachmentValues(value);
    case 'button':
      return withJson(value, pickText(value, ['url', 'label']));
    case 'aiText':
      return withJson(value, pickText(value, ['value']));
    case 'barcode':
      return withJson(value, pickText(value, ['text']));
    default:
      return valuesByRuntimeType(value);
  }
}

function dateValues(value: string): PropertyValues {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? { valueText: value }
    : { valueText: value, valueDate: parsed };
}

function linkValues(value: unknown): PropertyValues {
  const ids = (Array.isArray(value) ? value : [value]).map((item) =>
    isObject(item) && typeof item.id === 'string' ? item.id : String(item)
  );
  return { valueJson: ids, valueText: ids.join(', ') };
}

function attachmentValues(value: unknown): PropertyValues {
  const files = (Array.isArray(value) ? value : [value]).filter(isAttachment);
  return {
    valueJson: files.map((file) => ({
      id: file.id,
      filename: file.filename,
      type: file.type,
      size: file.size,
    })),
    valueText: files.map((file) => file.filename).join(', '),
  };
}

function valuesByRuntimeType(value: unknown): PropertyValues {
  if (typeof value === 'string') return { valueText: value };
  if (typeof value === 'number') return { valueNumber: value, valueText: String(value) };
  if (typeof value === 'boolean') return { valueBoolean: value, valueText: String(value) };
  if (Array.isArray(value)) {
    return { valueJson: value, valueText: value.map(displayText).join(', ') };
  }
  return withJson(value, displayText(value));
}

function withJson(value: unknown, text: string | undefined): PropertyValues {
  return text === undefined ? { valueJson: value } : { valueJson: value, valueText: text };
}

function pickText(value: unknown, keys: string[]): string | undefined {
  if (!isObject(value)) return typeof value === 'string' ? value : undefined;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return undefined;
}

/** Human-readable form of a single value, used for valueText and record titles. */
export function displayText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(displayText).join(', ');
  if (isObject(value)) {
    // Formula errors arrive as { error: '#ERROR!' }; NaN/Infinity as { specialValue }.
    const text = pickText(value, [
      'name',
      'filename',
      'email',
      'text',
      'label',
      'error',
      'specialValue',
    ]);
    if (text !== undefined) return text;
  }
  return JSON.stringify(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
