import { RawEntity } from '../../../src/connectors/interfaces';
import {
  AirtableAttachment,
  AirtableRecord,
  AirtableTableExtract,
  AirtableTableSchema,
} from '../../../src/connectors/airtable/airtable.types';

/**
 * A 5-table Airtable base, shaped exactly as the API returns it with
 * returnFieldsByFieldId=true. It exercises every field shape a migration has to handle:
 * two-way linked records, attachments, formulas (including an error value), lookups,
 * rollups, counts, selects, collaborators, dates and omitted empty fields.
 */

/** Airtable IDs are a 3-letter prefix plus 14 alphanumeric characters. */
const airtableId = (prefix: string, name: string, n: number): string =>
  prefix + (name + '0'.repeat(14)).slice(0, 14 - String(n).length) + n;

export const BASE_ID = airtableId('app', 'Agency', 1);
export const TABLE = {
  clients: airtableId('tbl', 'Clients', 1),
  projects: airtableId('tbl', 'Projects', 1),
  tasks: airtableId('tbl', 'Tasks', 1),
  people: airtableId('tbl', 'People', 1),
  invoices: airtableId('tbl', 'Invoices', 1),
};

const fld = (name: string): string => airtableId('fld', name, 1);
export const FIELD = {
  clientName: fld('ClientName'),
  clientEmail: fld('ClientEmail'),
  clientProjects: fld('ClientProjects'),
  clientInvoices: fld('ClientInvoices'),
  clientLogo: fld('ClientLogo'),
  projectName: fld('ProjectName'),
  projectClient: fld('ProjectClient'),
  projectStatus: fld('ProjectStatus'),
  projectBudget: fld('ProjectBudget'),
  projectStart: fld('ProjectStart'),
  projectBrief: fld('ProjectBrief'),
  projectTasks: fld('ProjectTasks'),
  projectTaskCount: fld('ProjectTaskCnt'),
  projectHours: fld('ProjectHours'),
  taskTitle: fld('TaskTitle'),
  taskProject: fld('TaskProject'),
  taskAssignee: fld('TaskAssignee'),
  taskDone: fld('TaskDone'),
  taskDue: fld('TaskDue'),
  taskHours: fld('TaskHours'),
  taskTags: fld('TaskTags'),
  taskDaysLeft: fld('TaskDaysLeft'),
  taskClientName: fld('TaskClientName'),
  taskCreatedBy: fld('TaskCreatedBy'),
  personName: fld('PersonName'),
  personEmail: fld('PersonEmail'),
  personRole: fld('PersonRole'),
  personTasks: fld('PersonTasks'),
  personPhoto: fld('PersonPhoto'),
  invoiceRef: fld('InvoiceRef'),
  invoiceClient: fld('InvoiceClient'),
  invoiceAmount: fld('InvoiceAmount'),
  invoicePaid: fld('InvoicePaid'),
  invoiceIssued: fld('InvoiceIssued'),
  invoicePdf: fld('InvoicePdf'),
  invoiceWithVat: fld('InvoiceWithVat'),
};

export const REC = {
  acme: airtableId('rec', 'Client', 1),
  globex: airtableId('rec', 'Client', 2),
  website: airtableId('rec', 'Project', 1),
  brand: airtableId('rec', 'Project', 2),
  dataPlatform: airtableId('rec', 'Project', 3),
  ada: airtableId('rec', 'Person', 1),
  grace: airtableId('rec', 'Person', 2),
  linus: airtableId('rec', 'Person', 3),
  wireframes: airtableId('rec', 'Task', 1),
  copy: airtableId('rec', 'Task', 2),
  launch: airtableId('rec', 'Task', 3),
  logo: airtableId('rec', 'Task', 4),
  pipeline: airtableId('rec', 'Task', 5),
  dashboards: airtableId('rec', 'Task', 6),
  inv1: airtableId('rec', 'Invoice', 1),
  inv2: airtableId('rec', 'Invoice', 2),
  inv3: airtableId('rec', 'Invoice', 3),
};

const link = (linkedTableId: string, inverseLinkFieldId: string) => ({
  linkedTableId,
  inverseLinkFieldId,
  prefersSingleRecordLink: false,
});
const choices = (...names: string[]) => ({
  choices: names.map((name, i) => ({
    id: airtableId('sel', name, i + 1),
    name,
    color: 'blueLight2',
  })),
});

export const TABLES: AirtableTableSchema[] = [
  {
    id: TABLE.clients,
    name: 'Clients',
    primaryFieldId: FIELD.clientName,
    fields: [
      { id: FIELD.clientName, name: 'Name', type: 'singleLineText' },
      { id: FIELD.clientEmail, name: 'Email', type: 'email' },
      {
        id: FIELD.clientProjects,
        name: 'Projects',
        type: 'multipleRecordLinks',
        options: link(TABLE.projects, FIELD.projectClient),
      },
      {
        id: FIELD.clientInvoices,
        name: 'Invoices',
        type: 'multipleRecordLinks',
        options: link(TABLE.invoices, FIELD.invoiceClient),
      },
      {
        id: FIELD.clientLogo,
        name: 'Logo',
        type: 'multipleAttachments',
        options: { isReversed: false },
      },
    ],
  },
  {
    id: TABLE.projects,
    name: 'Projects',
    primaryFieldId: FIELD.projectName,
    fields: [
      { id: FIELD.projectName, name: 'Name', type: 'singleLineText' },
      {
        id: FIELD.projectClient,
        name: 'Client',
        type: 'multipleRecordLinks',
        options: link(TABLE.clients, FIELD.clientProjects),
      },
      {
        id: FIELD.projectStatus,
        name: 'Status',
        type: 'singleSelect',
        options: choices('Planning', 'Active', 'Done'),
      },
      {
        id: FIELD.projectBudget,
        name: 'Budget',
        type: 'currency',
        options: { precision: 2, symbol: '£' },
      },
      {
        id: FIELD.projectStart,
        name: 'Start',
        type: 'date',
        options: { dateFormat: { name: 'iso' } },
      },
      { id: FIELD.projectBrief, name: 'Brief', type: 'multipleAttachments' },
      {
        id: FIELD.projectTasks,
        name: 'Tasks',
        type: 'multipleRecordLinks',
        options: link(TABLE.tasks, FIELD.taskProject),
      },
      {
        id: FIELD.projectTaskCount,
        name: 'Task count',
        type: 'count',
        options: { recordLinkFieldId: FIELD.projectTasks },
      },
      {
        id: FIELD.projectHours,
        name: 'Total hours',
        type: 'rollup',
        options: { result: { type: 'number' } },
      },
    ],
  },
  {
    id: TABLE.tasks,
    name: 'Tasks',
    primaryFieldId: FIELD.taskTitle,
    fields: [
      { id: FIELD.taskTitle, name: 'Title', type: 'singleLineText' },
      {
        id: FIELD.taskProject,
        name: 'Project',
        type: 'multipleRecordLinks',
        options: link(TABLE.projects, FIELD.projectTasks),
      },
      {
        id: FIELD.taskAssignee,
        name: 'Assignee',
        type: 'multipleRecordLinks',
        options: link(TABLE.people, FIELD.personTasks),
      },
      { id: FIELD.taskDone, name: 'Done', type: 'checkbox' },
      { id: FIELD.taskDue, name: 'Due', type: 'date' },
      { id: FIELD.taskHours, name: 'Hours', type: 'number', options: { precision: 1 } },
      {
        id: FIELD.taskTags,
        name: 'Tags',
        type: 'multipleSelects',
        options: choices('Design', 'Copy', 'Engineering'),
      },
      {
        id: FIELD.taskDaysLeft,
        name: 'Days left',
        type: 'formula',
        options: { result: { type: 'number' } },
      },
      {
        id: FIELD.taskClientName,
        name: 'Client name',
        type: 'multipleLookupValues',
        options: { result: { type: 'singleLineText' } },
      },
      { id: FIELD.taskCreatedBy, name: 'Created by', type: 'createdBy' },
    ],
  },
  {
    id: TABLE.people,
    name: 'People',
    primaryFieldId: FIELD.personName,
    fields: [
      { id: FIELD.personName, name: 'Name', type: 'singleLineText' },
      { id: FIELD.personEmail, name: 'Email', type: 'email' },
      {
        id: FIELD.personRole,
        name: 'Role',
        type: 'singleSelect',
        options: choices('Designer', 'Writer', 'Engineer'),
      },
      {
        id: FIELD.personTasks,
        name: 'Tasks',
        type: 'multipleRecordLinks',
        options: link(TABLE.tasks, FIELD.taskAssignee),
      },
      { id: FIELD.personPhoto, name: 'Photo', type: 'multipleAttachments' },
    ],
  },
  {
    id: TABLE.invoices,
    name: 'Invoices',
    primaryFieldId: FIELD.invoiceRef,
    fields: [
      {
        id: FIELD.invoiceRef,
        name: 'Reference',
        type: 'formula',
        options: { result: { type: 'singleLineText' } },
      },
      {
        id: FIELD.invoiceClient,
        name: 'Client',
        type: 'multipleRecordLinks',
        options: link(TABLE.clients, FIELD.clientInvoices),
      },
      {
        id: FIELD.invoiceAmount,
        name: 'Amount',
        type: 'currency',
        options: { precision: 2, symbol: '£' },
      },
      { id: FIELD.invoicePaid, name: 'Paid', type: 'checkbox' },
      { id: FIELD.invoiceIssued, name: 'Issued', type: 'dateTime' },
      { id: FIELD.invoicePdf, name: 'PDF', type: 'multipleAttachments' },
      {
        id: FIELD.invoiceWithVat,
        name: 'Amount with VAT',
        type: 'formula',
        options: { result: { type: 'currency' } },
      },
    ],
  },
];

const file = (
  name: string,
  n: number,
  filename: string,
  type: string,
  size: number
): AirtableAttachment => ({
  id: airtableId('att', name, n),
  url: `https://v5.airtableusercontent.com/v3/u/expiring/${filename}`,
  filename,
  type,
  size,
});

const creator = { id: 'usrPhil000000001', email: 'owner@example.com', name: 'Phil' };
const record = (
  id: string,
  createdTime: string,
  fields: Record<string, unknown>
): AirtableRecord => ({
  id,
  createdTime,
  fields,
});

export const RECORDS: Record<string, AirtableRecord[]> = {
  [TABLE.clients]: [
    record(REC.acme, '2026-01-05T09:00:00.000Z', {
      [FIELD.clientName]: 'Acme Ltd',
      [FIELD.clientEmail]: 'hello@acme.example',
      [FIELD.clientProjects]: [REC.website, REC.brand],
      [FIELD.clientInvoices]: [REC.inv1, REC.inv2],
      [FIELD.clientLogo]: [
        { ...file('Logo', 1, 'acme-logo.png', 'image/png', 18_432), width: 512, height: 512 },
      ],
    }),
    record(REC.globex, '2026-01-06T09:00:00.000Z', {
      [FIELD.clientName]: 'Globex',
      [FIELD.clientProjects]: [REC.dataPlatform],
      [FIELD.clientInvoices]: [REC.inv3],
    }),
  ],
  [TABLE.projects]: [
    record(REC.website, '2026-01-10T10:00:00.000Z', {
      [FIELD.projectName]: 'Website redesign',
      [FIELD.projectClient]: [REC.acme],
      [FIELD.projectStatus]: 'Active',
      [FIELD.projectBudget]: 12500.5,
      [FIELD.projectStart]: '2026-02-01',
      [FIELD.projectBrief]: [file('Brief', 1, 'website-brief.pdf', 'application/pdf', 245_760)],
      [FIELD.projectTasks]: [REC.wireframes, REC.copy, REC.launch],
      [FIELD.projectTaskCount]: 3,
      [FIELD.projectHours]: 42.5,
    }),
    record(REC.brand, '2026-01-11T10:00:00.000Z', {
      [FIELD.projectName]: 'Brand refresh',
      [FIELD.projectClient]: [REC.acme],
      [FIELD.projectStatus]: 'Planning',
      [FIELD.projectBudget]: 4000,
      [FIELD.projectTasks]: [REC.logo],
      [FIELD.projectTaskCount]: 1,
      [FIELD.projectHours]: 6,
    }),
    record(REC.dataPlatform, '2026-01-12T10:00:00.000Z', {
      [FIELD.projectName]: 'Data platform',
      [FIELD.projectClient]: [REC.globex],
      [FIELD.projectStatus]: 'Done',
      [FIELD.projectBudget]: 30000,
      [FIELD.projectStart]: '2026-01-15',
      [FIELD.projectTasks]: [REC.pipeline, REC.dashboards],
      [FIELD.projectTaskCount]: 2,
      [FIELD.projectHours]: 80,
    }),
  ],
  [TABLE.tasks]: [
    record(REC.wireframes, '2026-01-13T11:00:00.000Z', {
      [FIELD.taskTitle]: 'Wireframes',
      [FIELD.taskProject]: [REC.website],
      [FIELD.taskAssignee]: [REC.ada],
      [FIELD.taskDone]: true,
      [FIELD.taskDue]: '2026-02-10',
      [FIELD.taskHours]: 12,
      [FIELD.taskTags]: ['Design'],
      [FIELD.taskDaysLeft]: -3,
      [FIELD.taskClientName]: ['Acme Ltd'],
      [FIELD.taskCreatedBy]: creator,
    }),
    record(REC.copy, '2026-01-13T11:05:00.000Z', {
      [FIELD.taskTitle]: 'Homepage copy',
      [FIELD.taskProject]: [REC.website],
      [FIELD.taskAssignee]: [REC.grace],
      [FIELD.taskDue]: '2026-02-20',
      [FIELD.taskHours]: 8.5,
      [FIELD.taskTags]: ['Copy', 'Design'],
      [FIELD.taskDaysLeft]: 7,
      [FIELD.taskClientName]: ['Acme Ltd'],
      [FIELD.taskCreatedBy]: creator,
    }),
    record(REC.launch, '2026-01-13T11:10:00.000Z', {
      // No due date and not done: Airtable omits both fields entirely.
      [FIELD.taskTitle]: 'Launch',
      [FIELD.taskProject]: [REC.website],
      [FIELD.taskAssignee]: [REC.ada, REC.linus],
      [FIELD.taskHours]: 22,
      [FIELD.taskClientName]: ['Acme Ltd'],
      [FIELD.taskCreatedBy]: creator,
    }),
    record(REC.logo, '2026-01-14T11:00:00.000Z', {
      [FIELD.taskTitle]: 'New logo',
      [FIELD.taskProject]: [REC.brand],
      [FIELD.taskAssignee]: [REC.ada],
      [FIELD.taskDue]: '2026-03-01',
      [FIELD.taskHours]: 6,
      [FIELD.taskTags]: ['Design'],
      [FIELD.taskDaysLeft]: 16,
      [FIELD.taskClientName]: ['Acme Ltd'],
      [FIELD.taskCreatedBy]: creator,
    }),
    record(REC.pipeline, '2026-01-15T11:00:00.000Z', {
      [FIELD.taskTitle]: 'Data pipeline',
      [FIELD.taskProject]: [REC.dataPlatform],
      [FIELD.taskAssignee]: [REC.linus],
      [FIELD.taskDone]: true,
      [FIELD.taskDue]: '2026-01-31',
      [FIELD.taskHours]: 50,
      [FIELD.taskTags]: ['Engineering'],
      [FIELD.taskDaysLeft]: -14,
      [FIELD.taskClientName]: ['Globex'],
      [FIELD.taskCreatedBy]: creator,
    }),
    record(REC.dashboards, '2026-01-15T11:30:00.000Z', {
      [FIELD.taskTitle]: 'Dashboards',
      [FIELD.taskProject]: [REC.dataPlatform],
      [FIELD.taskAssignee]: [REC.linus, REC.grace],
      [FIELD.taskDone]: true,
      [FIELD.taskHours]: 30,
      [FIELD.taskTags]: ['Engineering', 'Design'],
      [FIELD.taskClientName]: ['Globex'],
      [FIELD.taskCreatedBy]: creator,
    }),
  ],
  [TABLE.people]: [
    record(REC.ada, '2026-01-02T08:00:00.000Z', {
      [FIELD.personName]: 'Ada',
      [FIELD.personEmail]: 'ada@agency.example',
      [FIELD.personRole]: 'Designer',
      [FIELD.personTasks]: [REC.wireframes, REC.launch, REC.logo],
      [FIELD.personPhoto]: [
        { ...file('Photo', 1, 'ada.jpg', 'image/jpeg', 40_960), width: 400, height: 400 },
      ],
    }),
    record(REC.grace, '2026-01-02T08:05:00.000Z', {
      [FIELD.personName]: 'Grace',
      [FIELD.personEmail]: 'grace@agency.example',
      [FIELD.personRole]: 'Writer',
      [FIELD.personTasks]: [REC.copy, REC.dashboards],
    }),
    record(REC.linus, '2026-01-02T08:10:00.000Z', {
      [FIELD.personName]: 'Linus',
      [FIELD.personRole]: 'Engineer',
      [FIELD.personTasks]: [REC.launch, REC.pipeline, REC.dashboards],
    }),
  ],
  [TABLE.invoices]: [
    record(REC.inv1, '2026-02-01T12:00:00.000Z', {
      [FIELD.invoiceRef]: 'INV-001',
      [FIELD.invoiceClient]: [REC.acme],
      [FIELD.invoiceAmount]: 5000,
      [FIELD.invoicePaid]: true,
      [FIELD.invoiceIssued]: '2026-02-01T12:00:00.000Z',
      [FIELD.invoicePdf]: [file('Invoice', 1, 'INV-001.pdf', 'application/pdf', 61_440)],
      [FIELD.invoiceWithVat]: 6000,
    }),
    record(REC.inv2, '2026-03-01T12:00:00.000Z', {
      [FIELD.invoiceRef]: 'INV-002',
      [FIELD.invoiceClient]: [REC.acme],
      [FIELD.invoiceAmount]: 7500.5,
      [FIELD.invoiceIssued]: '2026-03-01T12:00:00.000Z',
      [FIELD.invoicePdf]: [file('Invoice', 2, 'INV-002.pdf', 'application/pdf', 63_488)],
      [FIELD.invoiceWithVat]: 9000.6,
    }),
    record(REC.inv3, '2026-03-15T12:00:00.000Z', {
      [FIELD.invoiceRef]: 'INV-003',
      [FIELD.invoiceClient]: [REC.globex],
      [FIELD.invoiceAmount]: 30000,
      [FIELD.invoiceIssued]: '2026-03-15T12:00:00.000Z',
      // A broken formula comes back as an error object instead of a value.
      [FIELD.invoiceWithVat]: { error: '#ERROR!' },
    }),
  ],
};

export function tableSchema(tableId: string): AirtableTableSchema {
  const table = TABLES.find((t) => t.id === tableId);
  if (!table) throw new Error(`Unknown fixture table ${tableId}`);
  return table;
}

/** The RawEntity the connector would return for one table. */
export function rawTable(tableId: string, options: { withSchema?: boolean } = {}): RawEntity {
  const rawData: AirtableTableExtract = {
    baseId: BASE_ID,
    tableId,
    table: options.withSchema === false ? undefined : tableSchema(tableId),
    records: RECORDS[tableId],
  };
  return {
    id: `${BASE_ID}/${tableId}`,
    type: 'table',
    rawData,
    extractedAt: new Date('2026-11-05T00:00:00Z'),
  };
}

export const ALL_TABLE_IDS = Object.values(TABLE);
