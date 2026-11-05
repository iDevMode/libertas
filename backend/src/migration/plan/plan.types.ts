/** Notion property types Libertas can create in a data source. */
export type NotionPropertyType =
  | 'title'
  | 'rich_text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone_number'
  | 'files'
  | 'relation';

/** How one source field will be carried into the destination. */
export interface FieldPlan {
  sourceFieldId: string;
  sourceName: string;
  sourceType: string;
  /** Property name in Notion; unique within its data source. */
  targetName: string;
  /** null means the field is not migrated (see note). */
  targetType: NotionPropertyType | null;
  numberFormat?: 'number' | 'percent';
  /** Select and multi-select options, already sanitised for Notion. */
  options?: string[];
  /** Universal database ID of the linked table, for relations. */
  relationTargetDatabaseId?: string;
  /** True when the destination cannot reproduce the field exactly. */
  lossy: boolean;
  note?: string;
}

export interface TablePlan {
  sourceDatabaseId: string;
  name: string;
  recordCount: number;
  fields: FieldPlan[];
  /** Text property holding each record's source ID, used to verify and resume. */
  sourceIdPropertyName: string;
}

export interface PlanWarning {
  table: string;
  field: string;
  message: string;
}

export interface MigrationPlan {
  sourcePlatform: 'airtable';
  tables: TablePlan[];
  /** Everything that will not survive the move exactly, for the user to approve. */
  warnings: PlanWarning[];
}
