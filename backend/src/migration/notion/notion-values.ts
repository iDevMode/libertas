import { NormalizedProperty } from '../../transformers/interfaces.js';
import { FieldPlan } from '../plan/plan.types.js';
import { sanitizeOptionName, uniqueOptions } from '../plan/notion-names.js';

/** Notion request limits (developers.notion.com/reference/request-limits). */
export const NOTION_LIMITS = {
  textContent: 2000,
  richTextItems: 100,
  url: 2000,
  emailOrPhone: 200,
  multiSelect: 100,
  relationsPerRequest: 100,
} as const;

export type NotionSchemaConfig = Record<string, unknown>;
export type NotionPropertyValue = Record<string, unknown>;

/** Schema config for one property, as sent to create-database or update-data-source. */
export function toSchemaConfig(
  field: FieldPlan,
  relationDataSourceId?: string
): NotionSchemaConfig | undefined {
  const type = field.targetType;
  switch (type) {
    case null:
      return undefined;
    case 'number':
      return { type, number: { format: field.numberFormat ?? 'number' } };
    case 'select':
    case 'multi_select':
      return { type, [type]: { options: (field.options ?? []).map((name) => ({ name })) } };
    case 'relation':
      if (!relationDataSourceId) return undefined;
      return {
        type,
        relation: {
          data_source_id: relationDataSourceId,
          type: 'single_property',
          single_property: {},
        },
      };
    default:
      return { type, [type]: {} };
  }
}

/** Splits text into Notion rich text items of at most 2,000 characters, at most 100 items. */
export function toRichText(text: string): Array<{ type: 'text'; text: { content: string } }> {
  const items: Array<{ type: 'text'; text: { content: string } }> = [];
  for (
    let i = 0;
    i < text.length && items.length < NOTION_LIMITS.richTextItems;
    i += NOTION_LIMITS.textContent
  ) {
    items.push({ type: 'text', text: { content: text.slice(i, i + NOTION_LIMITS.textContent) } });
  }
  return items;
}

export function titleValue(title: string): NotionPropertyValue {
  return { title: toRichText(title) };
}

/**
 * Converts one normalised property into a Notion page property value.
 * Returns undefined when there is nothing valid to write; relations and files are
 * written elsewhere (relations need destination page IDs, files need uploading).
 */
export function toPropertyValue(
  field: FieldPlan,
  prop: NormalizedProperty
): NotionPropertyValue | undefined {
  const text = prop.valueText ?? '';
  switch (field.targetType) {
    case 'rich_text':
      return text.length > 0 ? { rich_text: toRichText(text) } : undefined;
    case 'title':
      return text.length > 0 ? titleValue(text) : undefined;
    case 'number':
      return numberValue(prop);
    case 'select':
      return text.length > 0 ? { select: { name: sanitizeOptionName(text) } } : undefined;
    case 'multi_select':
      return multiSelectValue(prop);
    case 'date':
      return dateValue(prop);
    case 'checkbox':
      return { checkbox: prop.valueBoolean ?? text === 'true' };
    case 'url':
      return limitedText('url', text, NOTION_LIMITS.url);
    case 'email':
      return limitedText('email', text, NOTION_LIMITS.emailOrPhone);
    case 'phone_number':
      return limitedText('phone_number', text, NOTION_LIMITS.emailOrPhone);
    default:
      return undefined;
  }
}

function numberValue(prop: NormalizedProperty): NotionPropertyValue | undefined {
  const value = prop.valueNumber ?? (prop.valueText !== undefined ? Number(prop.valueText) : NaN);
  return Number.isFinite(value) ? { number: value } : undefined;
}

function multiSelectValue(prop: NormalizedProperty): NotionPropertyValue | undefined {
  const names = Array.isArray(prop.valueJson)
    ? prop.valueJson.map((item) => String(item))
    : (prop.valueText ?? '').split(',').filter((part) => part.trim().length > 0);
  const options = uniqueOptions(names).slice(0, NOTION_LIMITS.multiSelect);
  return options.length > 0 ? { multi_select: options.map((name) => ({ name })) } : undefined;
}

/** Airtable dates arrive as "YYYY-MM-DD" and date-times as ISO strings; both are valid Notion starts. */
function dateValue(prop: NormalizedProperty): NotionPropertyValue | undefined {
  const raw = prop.valueText ?? prop.valueDate?.toISOString();
  if (!raw) return undefined;
  if (Number.isNaN(new Date(raw).getTime())) return undefined;
  return { date: { start: raw } };
}

function limitedText(type: string, text: string, max: number): NotionPropertyValue | undefined {
  if (text.length === 0 || text.length > max) return undefined;
  return { [type]: text };
}

export function relationValue(pageIds: string[]): NotionPropertyValue {
  return { relation: pageIds.map((id) => ({ id })) };
}
