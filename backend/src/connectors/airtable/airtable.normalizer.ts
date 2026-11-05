import { RawEntity } from '../interfaces.js';
import {
  NormalizedAttachment,
  NormalizedEntity,
  NormalizedProperty,
  NormalizedRelation,
  NormalizedResult,
} from '../../transformers/interfaces.js';
import { AirtableFieldSchema, AirtableRecord, AirtableTableExtract } from './airtable.types.js';
import { isComputedAirtableField, mapAirtableFieldType } from './airtable.field-types.js';
import {
  displayText,
  inferAirtableFieldType,
  isAttachment,
  normalizeAirtableValue,
} from './airtable.value-normalizer.js';

const AIRTABLE_WEB_BASE = 'https://airtable.com';

/** Field metadata stored on the table entity, read later by the migration planner. */
export interface AirtableFieldSummary {
  id: string;
  name: string;
  airtableType: string;
  propertyType: string;
  computed: boolean;
  /** Universal database ID of the linked table, for multipleRecordLinks fields. */
  linkedDatabaseId?: string;
  choices?: string[];
  resultType?: string;
}

interface TableContext {
  baseId: string;
  tableId: string;
  databaseId: string;
  tableName: string;
  primaryFieldId?: string;
  schemaAvailable: boolean;
  fields: AirtableFieldSchema[];
  byId: Map<string, AirtableFieldSchema>;
  byName: Map<string, AirtableFieldSchema>;
}

/**
 * Normalises one extracted Airtable table into the universal schema.
 *
 * Output: one 'database' entity for the table, then one 'record' entity per row.
 * IDs are deterministic (derived from Airtable IDs) so re-running a migration
 * produces the same universal IDs, which keeps runs idempotent and checkable.
 */
export class AirtableNormalizer {
  normalizeTable(raw: RawEntity): NormalizedResult[] {
    const extract = parseExtract(raw);
    const context = buildContext(extract);
    const records = extract.records.map((record) => this.normalizeRecord(context, record));
    return [this.normalizeTableEntity(context, extract.records.length), ...records];
  }

  private normalizeTableEntity(context: TableContext, recordCount: number): NormalizedResult {
    const entity: NormalizedEntity = {
      id: context.databaseId,
      entityType: 'database',
      title: context.tableName,
      // No parentId: the base itself is not exported as an entity, so it lives in metadata.
      sourcePlatform: 'airtable',
      sourceUrl: `${AIRTABLE_WEB_BASE}/${context.baseId}/${context.tableId}`,
      metadata: {
        baseId: context.baseId,
        tableId: context.tableId,
        primaryFieldId: context.primaryFieldId,
        schemaAvailable: context.schemaAvailable,
        recordCount,
        fields: context.fields.map((field) => summarizeField(context.baseId, field)),
      },
    };
    return emptyResult(entity);
  }

  private normalizeRecord(context: TableContext, record: AirtableRecord): NormalizedResult {
    const result = emptyResult(recordEntity(context, record));
    result.relations.push({
      id: `${record.id}:parent`,
      fromEntityId: record.id,
      toEntityId: context.databaseId,
      relationType: 'child_of',
    });

    for (const [key, value] of Object.entries(record.fields)) {
      const field = resolveField(context, key, value);
      result.properties.push(toProperty(context, record.id, field, value));
      if (field.type === 'multipleRecordLinks') {
        result.relations.push(...toRelations(context, record.id, field, value));
      }
      if (field.type === 'multipleAttachments') {
        result.attachments.push(...toAttachments(record.id, field, value));
      }
    }

    result.properties.sort((a, b) => a.position - b.position);
    return result;
  }
}

function parseExtract(raw: RawEntity): AirtableTableExtract {
  const data = raw.rawData as Partial<AirtableTableExtract> | undefined;
  if (!data || typeof data.baseId !== 'string' || typeof data.tableId !== 'string') {
    throw new Error(`Airtable entity ${raw.id} is missing baseId or tableId`);
  }
  if (!Array.isArray(data.records)) {
    throw new Error(`Airtable entity ${raw.id} has no records array`);
  }
  return { baseId: data.baseId, tableId: data.tableId, table: data.table, records: data.records };
}

function buildContext(extract: AirtableTableExtract): TableContext {
  const fields = extract.table?.fields ?? inferFields(extract.records);
  return {
    baseId: extract.baseId,
    tableId: extract.tableId,
    databaseId: `${extract.baseId}/${extract.tableId}`,
    tableName: extract.table?.name ?? extract.tableId,
    primaryFieldId: extract.table?.primaryFieldId,
    schemaAvailable: Boolean(extract.table),
    fields,
    byId: new Map(fields.map((field) => [field.id, field])),
    byName: new Map(fields.map((field) => [field.name, field])),
  };
}

/** Without schema access, field names and types are inferred from the records themselves. */
function inferFields(records: AirtableRecord[]): AirtableFieldSchema[] {
  const fields = new Map<string, AirtableFieldSchema>();
  for (const record of records) {
    for (const [key, value] of Object.entries(record.fields)) {
      if (!fields.has(key)) {
        fields.set(key, { id: key, name: key, type: inferAirtableFieldType(value) });
      }
    }
  }
  return [...fields.values()];
}

function resolveField(context: TableContext, key: string, value: unknown): AirtableFieldSchema {
  return (
    context.byId.get(key) ??
    context.byName.get(key) ?? { id: key, name: key, type: inferAirtableFieldType(value) }
  );
}

function fieldPosition(context: TableContext, field: AirtableFieldSchema): number {
  const index = context.fields.indexOf(field);
  return index === -1 ? context.fields.length : index;
}

function recordEntity(context: TableContext, record: AirtableRecord): NormalizedEntity {
  return {
    id: record.id,
    entityType: 'record',
    title: recordTitle(context, record),
    createdAt: new Date(record.createdTime),
    parentId: context.databaseId,
    sourcePlatform: 'airtable',
    sourceUrl: `${AIRTABLE_WEB_BASE}/${context.baseId}/${context.tableId}/${record.id}`,
    metadata: { baseId: context.baseId, tableId: context.tableId },
  };
}

function recordTitle(context: TableContext, record: AirtableRecord): string {
  const primary = context.primaryFieldId ? context.byId.get(context.primaryFieldId) : undefined;
  if (!primary) return record.id;
  const value = record.fields[primary.id] ?? record.fields[primary.name];
  const text = displayText(value).trim();
  return text.length > 0 ? text : record.id;
}

function toProperty(
  context: TableContext,
  recordId: string,
  field: AirtableFieldSchema,
  value: unknown
): NormalizedProperty {
  return {
    id: `${recordId}:${field.id}`,
    entityId: recordId,
    propertyName: field.name,
    propertyType: mapAirtableFieldType(field.type),
    position: fieldPosition(context, field),
    ...normalizeAirtableValue(value, field.type),
  };
}

function toRelations(
  context: TableContext,
  recordId: string,
  field: AirtableFieldSchema,
  value: unknown
): NormalizedRelation[] {
  const targets = Array.isArray(value) ? value : [];
  const linkedTableId = field.options?.linkedTableId;
  return targets
    .filter((target): target is string => typeof target === 'string')
    .map((targetId) => ({
      id: `${recordId}:${field.id}:${targetId}`,
      fromEntityId: recordId,
      toEntityId: targetId,
      relationType: 'related_to' as const,
      metadata: {
        propertyName: field.name,
        fieldId: field.id,
        targetDatabaseId: linkedTableId ? `${context.baseId}/${linkedTableId}` : undefined,
      },
    }));
}

function toAttachments(
  recordId: string,
  field: AirtableFieldSchema,
  value: unknown
): NormalizedAttachment[] {
  const files = (Array.isArray(value) ? value : []).filter(isAttachment);
  return files.map((file) => ({
    id: file.id,
    entityId: recordId,
    fileName: file.filename,
    fileType: file.type,
    fileSize: file.size,
    sourceUrl: file.url,
    metadata: {
      fieldId: field.id,
      propertyName: field.name,
      width: file.width,
      height: file.height,
      // Airtable attachment URLs are signed and expire, so files must be copied during the run.
      sourceUrlExpires: true,
    },
  }));
}

function summarizeField(baseId: string, field: AirtableFieldSchema): AirtableFieldSummary {
  const linkedTableId = field.options?.linkedTableId;
  return {
    id: field.id,
    name: field.name,
    airtableType: field.type,
    propertyType: mapAirtableFieldType(field.type),
    computed: isComputedAirtableField(field.type),
    linkedDatabaseId: linkedTableId ? `${baseId}/${linkedTableId}` : undefined,
    choices: field.options?.choices?.map((choice) => choice.name),
    resultType: field.options?.result?.type,
  };
}

function emptyResult(entity: NormalizedEntity): NormalizedResult {
  return { entity, properties: [], relations: [], contentBlocks: [], attachments: [] };
}
