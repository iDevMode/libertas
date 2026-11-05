import { PropertyType } from '../../common/types.js';

/**
 * Maps Airtable field types to universal property types.
 * Unknown types fall back to 'text' so no field is ever dropped.
 */
const FIELD_TYPE_MAP: Record<string, PropertyType> = {
  singleLineText: 'text',
  multilineText: 'text',
  richText: 'text',
  barcode: 'text',
  aiText: 'text',
  singleCollaborator: 'text',
  multipleCollaborators: 'text',
  createdBy: 'text',
  lastModifiedBy: 'text',
  button: 'url',
  number: 'number',
  currency: 'number',
  percent: 'number',
  rating: 'number',
  duration: 'number',
  autoNumber: 'number',
  count: 'rollup',
  singleSelect: 'select',
  multipleSelects: 'multi_select',
  date: 'date',
  dateTime: 'date',
  createdTime: 'date',
  lastModifiedTime: 'date',
  checkbox: 'boolean',
  url: 'url',
  email: 'email',
  phoneNumber: 'phone',
  phone: 'phone',
  multipleRecordLinks: 'relation',
  multipleAttachments: 'file',
  formula: 'formula',
  rollup: 'rollup',
  lookup: 'rollup',
  multipleLookupValues: 'rollup',
};

/**
 * Field types whose values Airtable computes. They cannot be written back as-is,
 * so a migration must either rebuild the logic in the destination or keep a static copy.
 */
const COMPUTED_FIELD_TYPES = new Set([
  'formula',
  'rollup',
  'lookup',
  'multipleLookupValues',
  'count',
  'autoNumber',
  'createdTime',
  'lastModifiedTime',
  'createdBy',
  'lastModifiedBy',
  'button',
  'aiText',
]);

export function mapAirtableFieldType(airtableType: string): PropertyType {
  return FIELD_TYPE_MAP[airtableType] ?? 'text';
}

export function isComputedAirtableField(airtableType: string): boolean {
  return COMPUTED_FIELD_TYPES.has(airtableType);
}
