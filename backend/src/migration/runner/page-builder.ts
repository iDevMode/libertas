import { NormalizedResult } from '../../transformers/interfaces.js';
import { TablePlan } from '../plan/plan.types.js';
import {
  NotionPropertyValue,
  titleValue,
  toPropertyValue,
  toRichText,
} from '../notion/notion-values.js';
import { RunContext } from './run-context.js';

/** Fields filled in a later step, or not at all, rather than when the page is created. */
const NOT_SET_ON_CREATE = new Set(['title', 'relation', 'files']);

/**
 * Builds the Notion properties for one record's page: the title, every directly mappable
 * value, and the source record ID used to verify and resume. Values that had data but
 * cannot be represented (such as formula errors) are recorded on the report.
 */
export function buildPageProperties(
  context: RunContext,
  table: TablePlan,
  record: NormalizedResult
): Record<string, NotionPropertyValue> {
  const titleField = table.fields.find((field) => field.targetType === 'title');
  const properties: Record<string, NotionPropertyValue> = {
    [table.sourceIdPropertyName]: { rich_text: toRichText(record.entity.id) },
  };
  if (titleField) properties[titleField.targetName] = titleValue(record.entity.title);

  for (const prop of record.properties) {
    const field = context.field(table, prop.propertyName);
    if (!field || field.targetType === null || NOT_SET_ON_CREATE.has(field.targetType)) continue;

    const value = toPropertyValue(field, prop);
    if (value) {
      properties[field.targetName] = value;
    } else if (prop.valueText) {
      context.skipValue({
        table: table.name,
        recordId: record.entity.id,
        field: field.sourceName,
        value: prop.valueText,
      });
    }
  }
  return properties;
}
