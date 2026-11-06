import { NotionPropertyType } from './plan.types.js';

export interface FieldRule {
  targetType: NotionPropertyType | null;
  numberFormat?: 'number' | 'percent';
  lossy?: boolean;
  note?: string;
}

const STATIC_COPY =
  'Calculated in Airtable; copied as a fixed value that will not update in Notion.';

/**
 * Default mapping from Airtable field types to Notion properties.
 * The AI planner can override these per field; these are the safe defaults.
 */
const RULES: Record<string, FieldRule> = {
  singleLineText: { targetType: 'rich_text' },
  multilineText: { targetType: 'rich_text' },
  richText: { targetType: 'rich_text', lossy: true, note: 'Formatting is kept as Markdown text.' },
  number: { targetType: 'number' },
  currency: { targetType: 'number', lossy: true, note: 'Currency symbol is not carried over.' },
  percent: { targetType: 'number', numberFormat: 'percent' },
  rating: {
    targetType: 'number',
    lossy: true,
    note: 'Copied as a number; Notion has no rating field.',
  },
  duration: { targetType: 'number', lossy: true, note: 'Copied as a number of seconds.' },
  singleSelect: { targetType: 'select' },
  multipleSelects: { targetType: 'multi_select' },
  date: { targetType: 'date' },
  dateTime: { targetType: 'date' },
  checkbox: { targetType: 'checkbox' },
  url: { targetType: 'url' },
  email: { targetType: 'email' },
  phoneNumber: { targetType: 'phone_number' },
  multipleRecordLinks: { targetType: 'relation' },
  multipleAttachments: {
    targetType: 'files',
    lossy: true,
    note: 'Files are not copied yet; the property is created empty.',
  },
  formula: { targetType: 'rich_text', lossy: true, note: STATIC_COPY },
  rollup: { targetType: 'rich_text', lossy: true, note: STATIC_COPY },
  lookup: { targetType: 'rich_text', lossy: true, note: STATIC_COPY },
  multipleLookupValues: { targetType: 'rich_text', lossy: true, note: STATIC_COPY },
  count: { targetType: 'number', lossy: true, note: STATIC_COPY },
  autoNumber: { targetType: 'number', lossy: true, note: STATIC_COPY },
  createdTime: { targetType: 'date', lossy: true, note: 'Copied as a fixed date.' },
  lastModifiedTime: { targetType: 'date', lossy: true, note: 'Copied as a fixed date.' },
  createdBy: { targetType: 'rich_text', lossy: true, note: 'People are copied as names.' },
  lastModifiedBy: { targetType: 'rich_text', lossy: true, note: 'People are copied as names.' },
  singleCollaborator: { targetType: 'rich_text', lossy: true, note: 'People are copied as names.' },
  multipleCollaborators: {
    targetType: 'rich_text',
    lossy: true,
    note: 'People are copied as names.',
  },
  barcode: { targetType: 'rich_text' },
  button: { targetType: 'url', lossy: true, note: 'Copied as the button link; actions are lost.' },
  aiText: { targetType: 'rich_text', lossy: true, note: STATIC_COPY },
};

/** Numeric calculated fields stay numbers so they can still be sorted and summed in Notion. */
const NUMERIC_RESULTS = new Set(['number', 'currency', 'percent', 'duration', 'rating']);

export function ruleFor(airtableType: string, resultType?: string): FieldRule {
  const rule = RULES[airtableType];
  if (!rule) {
    return {
      targetType: 'rich_text',
      lossy: true,
      note: `Unknown field type "${airtableType}" copied as text.`,
    };
  }
  const calculated = rule.note === STATIC_COPY && rule.targetType === 'rich_text';
  if (calculated && resultType && NUMERIC_RESULTS.has(resultType)) {
    return {
      ...rule,
      targetType: 'number',
      numberFormat: resultType === 'percent' ? 'percent' : undefined,
    };
  }
  return rule;
}
