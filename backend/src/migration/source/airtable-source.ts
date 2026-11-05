import { AirtableConnector } from '../../connectors/airtable/airtable.connector.js';
import { AuthToken } from '../../connectors/interfaces.js';
import { universalNormalizer } from '../../transformers/universal.normalizer.js';
import { NormalizedResult } from '../../transformers/interfaces.js';

export interface ReadBaseOptions {
  /** Table names or IDs to include; all tables when omitted. */
  tables?: string[];
  onTable?: (name: string, records: number) => void;
}

/**
 * Reads an Airtable base (or some of its tables) and normalises it, ready for planning.
 * Asking for a table that does not exist is an error, so a typo never silently drops data.
 */
export async function readAirtableBase(
  connector: AirtableConnector,
  token: AuthToken,
  baseId: string,
  options: ReadBaseOptions = {}
): Promise<NormalizedResult[]> {
  const tables = await connector.listTables(token, baseId);
  const wanted = options.tables?.map((t) => t.trim()).filter((t) => t.length > 0);

  if (wanted?.length) {
    const known = new Set(tables.flatMap((t) => [t.id, t.name]));
    const missing = wanted.filter((t) => !known.has(t));
    if (missing.length) {
      throw new Error(`Unknown table(s) in base ${baseId}: ${missing.join(', ')}`);
    }
  }

  const selected = wanted?.length
    ? tables.filter((t) => wanted.includes(t.id) || wanted.includes(t.name))
    : tables;
  const results: NormalizedResult[] = [];
  for (const table of selected) {
    const raw = await connector.extractEntity(token, `${baseId}/${table.id}`);
    const normalized = universalNormalizer.normalize(raw, 'airtable');
    options.onTable?.(table.name, normalized.length - 1);
    results.push(...normalized);
  }
  return results;
}
