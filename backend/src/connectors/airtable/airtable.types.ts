/**
 * Shapes returned by the Airtable Web API that the connector and normaliser share.
 * Only the fields Libertas reads are typed; everything else is passed through untouched.
 */

export interface AirtableSelectChoice {
  id: string;
  name: string;
  color?: string;
}

export interface AirtableFieldOptions {
  choices?: AirtableSelectChoice[];
  /** Target table of a multipleRecordLinks field. */
  linkedTableId?: string;
  inverseLinkFieldId?: string;
  prefersSingleRecordLink?: boolean;
  /** Result type of formula, rollup and lookup fields. */
  result?: { type: string; options?: unknown };
  [key: string]: unknown;
}

export interface AirtableFieldSchema {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: AirtableFieldOptions;
}

export interface AirtableTableSchema {
  id: string;
  name: string;
  primaryFieldId: string;
  description?: string;
  fields: AirtableFieldSchema[];
}

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel?: string;
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  /** Keyed by field ID when requested with returnFieldsByFieldId, otherwise by field name. */
  fields: Record<string, unknown>;
  commentCount?: number;
}

export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
  width?: number;
  height?: number;
  thumbnails?: Record<string, { url: string; width: number; height: number }>;
}

export interface AirtableCollaborator {
  id: string;
  email?: string;
  name?: string;
}

/** Raw payload of one extracted table, stored in RawEntity.rawData. */
export interface AirtableTableExtract {
  baseId: string;
  tableId: string;
  /** Present when the schema scope is granted; the normaliser infers types without it. */
  table?: AirtableTableSchema;
  records: AirtableRecord[];
}

export interface AirtableListBasesResponse {
  bases: AirtableBase[];
  offset?: string;
}

export interface AirtableListTablesResponse {
  tables: AirtableTableSchema[];
}

export interface AirtableListRecordsResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface AirtableTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface AirtableErrorResponse {
  error?: string | { type?: string; message?: string };
}
