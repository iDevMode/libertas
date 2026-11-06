import { AirtableFieldSummary } from '../../connectors/airtable/airtable.normalizer.js';
import { NormalizedEntity, NormalizedResult } from '../../transformers/interfaces.js';
import { ruleFor } from './airtable-notion.rules.js';
import { PropertyNamer, uniqueOptions } from './notion-names.js';
import { FieldPlan, MigrationPlan, PlanWarning, TablePlan } from './plan.types.js';

export const SOURCE_ID_PROPERTY = 'Airtable record ID';
const NOT_IN_MIGRATION =
  'Links to a table that is not part of this migration; the links are dropped.';

/**
 * Builds the default Airtable -> Notion plan from normalised tables.
 * The plan is plain data so a user (or an AI agent) can review and edit it before a run.
 */
export function buildMigrationPlan(results: NormalizedResult[]): MigrationPlan {
  const tables = results
    .map((result) => result.entity)
    .filter((entity) => entity.entityType === 'database' && entity.sourcePlatform === 'airtable');
  const tableIds = new Set(tables.map((table) => table.id));

  const tablePlans = tables.map((table) => planTable(table, tableIds));
  return {
    sourcePlatform: 'airtable',
    tables: tablePlans,
    warnings: tablePlans.flatMap(collectWarnings),
  };
}

function planTable(table: NormalizedEntity, tableIds: Set<string>): TablePlan {
  const metadata = table.metadata ?? {};
  const fields = (metadata.fields as AirtableFieldSummary[] | undefined) ?? [];
  const primaryFieldId = metadata.primaryFieldId as string | undefined;
  const namer = new PropertyNamer();

  const primary = fields.find((field) => field.id === primaryFieldId);
  const titlePlan = primary ? planTitle(primary, namer) : syntheticTitle(namer);
  const otherPlans = fields
    .filter((field) => field !== primary)
    .map((field) => planField(field, namer, tableIds));

  return {
    sourceDatabaseId: table.id,
    name: table.title,
    recordCount: Number(metadata.recordCount ?? 0),
    fields: [titlePlan, ...otherPlans],
    sourceIdPropertyName: namer.take(SOURCE_ID_PROPERTY),
  };
}

function planTitle(field: AirtableFieldSummary, namer: PropertyNamer): FieldPlan {
  return {
    sourceFieldId: field.id,
    sourceName: field.name,
    sourceType: field.airtableType,
    targetName: namer.take(field.name),
    targetType: 'title',
    lossy: field.computed,
    note: field.computed ? 'Calculated in Airtable; the title is copied as fixed text.' : undefined,
  };
}

/** Tables read without schema access have no known primary field; Notion still needs a title. */
function syntheticTitle(namer: PropertyNamer): FieldPlan {
  return {
    sourceFieldId: '',
    sourceName: 'Record title',
    sourceType: 'unknown',
    targetName: namer.take('Name'),
    targetType: 'title',
    lossy: true,
    note: 'The table schema was unavailable, so titles use each record ID.',
  };
}

function planField(
  field: AirtableFieldSummary,
  namer: PropertyNamer,
  tableIds: Set<string>
): FieldPlan {
  const rule = ruleFor(field.airtableType, field.resultType);
  const plan: FieldPlan = {
    sourceFieldId: field.id,
    sourceName: field.name,
    sourceType: field.airtableType,
    targetName: namer.take(field.name),
    targetType: rule.targetType,
    numberFormat: rule.numberFormat,
    lossy: rule.lossy ?? false,
    note: rule.note,
  };

  if (rule.targetType === 'select' || rule.targetType === 'multi_select') {
    plan.options = uniqueOptions(field.choices ?? []);
  }
  if (rule.targetType === 'relation') {
    const target = field.linkedDatabaseId;
    if (target && tableIds.has(target)) {
      plan.relationTargetDatabaseId = target;
    } else {
      Object.assign(plan, { targetType: null, lossy: true, note: NOT_IN_MIGRATION });
    }
  }
  return plan;
}

function collectWarnings(table: TablePlan): PlanWarning[] {
  return table.fields
    .filter((field) => field.lossy && field.note)
    .map((field) => ({ table: table.name, field: field.sourceName, message: field.note! }));
}
