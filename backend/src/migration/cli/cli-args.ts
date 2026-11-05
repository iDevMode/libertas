import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliOptions {
  baseId: string;
  parentPageId?: string;
  tables?: string[];
  dryRun: boolean;
  runId: string;
  stateDir: string;
  airtableToken: string;
  notionToken?: string;
}

export const USAGE = `Move an Airtable base into Notion, keeping links between records.

Usage:
  npm run airtable-to-notion -- --base <appXXXX> --dry-run
  npm run airtable-to-notion -- --base <appXXXX> --parent <Notion page URL or ID>

Options:
  --base       Airtable base ID (starts with "app")
  --parent     Notion page to create the databases under; share it with your integration first
  --tables     Comma-separated table names or IDs (default: every table)
  --dry-run    Show what would happen without writing to Notion
  --run-id     Name for this migration; re-use it to resume (default: base + parent)
  --state-dir  Where progress is kept (default: ~/.libertas)

Environment:
  AIRTABLE_TOKEN  Airtable personal access token with data.records:read and schema.bases:read
  NOTION_TOKEN    Notion integration secret (not needed for --dry-run)`;

const NOTION_ID = /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Accepts a Notion page URL or ID and returns the ID in UUID form. */
export function parseNotionPageId(input: string): string {
  const path = input.split(/[?#]/)[0];
  const matches = path.match(new RegExp(NOTION_ID.source, 'gi'));
  const raw = matches?.at(-1)?.replace(/-/g, '');
  if (!raw) throw new Error(`Not a Notion page URL or ID: ${input}`);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`.toLowerCase();
}

export function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      base: { type: 'string' },
      parent: { type: 'string' },
      tables: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'run-id': { type: 'string' },
      'state-dir': { type: 'string' },
    },
    strict: true,
  });

  const baseId = values.base?.trim();
  if (!baseId || !/^app[A-Za-z0-9]{14}$/.test(baseId))
    throw new Error('--base must be an Airtable base ID like appXXXXXXXXXXXXXX');
  const dryRun = values['dry-run'] ?? false;
  const parentPageId = values.parent ? parseNotionPageId(values.parent) : undefined;
  if (!dryRun && !parentPageId) throw new Error('--parent is required unless you use --dry-run');

  const airtableToken = env.AIRTABLE_TOKEN?.trim();
  if (!airtableToken) throw new Error('Set AIRTABLE_TOKEN to an Airtable personal access token');
  const notionToken = env.NOTION_TOKEN?.trim();
  if (!dryRun && !notionToken)
    throw new Error('Set NOTION_TOKEN to your Notion integration secret');

  return {
    baseId,
    parentPageId,
    tables: values.tables?.split(','),
    dryRun,
    runId: values['run-id'] ?? `${baseId}-to-${parentPageId ?? 'dry-run'}`,
    stateDir: values['state-dir'] ?? join(homedir(), '.libertas'),
    airtableToken,
    notionToken,
  };
}
