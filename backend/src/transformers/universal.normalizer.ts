import { Platform } from '../common/types.js';
import { RawEntity } from '../connectors/interfaces.js';
import { INormalizer, IUniversalNormalizer, NormalizedResult } from './interfaces.js';
import { NotionNormalizer } from '../connectors/notion/notion.normalizer.js';
import { AirtableNormalizer } from '../connectors/airtable/airtable.normalizer.js';

/** Turns one raw extract into one or more normalised entities. */
type PlatformNormalizer = (raw: RawEntity) => NormalizedResult[];

function singleEntity(normalizer: INormalizer): PlatformNormalizer {
  return (raw) => [
    {
      entity: normalizer.normalizeEntity(raw),
      properties: normalizer.normalizeProperties(raw),
      relations: normalizer.normalizeRelations(raw),
      contentBlocks: normalizer.normalizeContentBlocks(raw),
      attachments: [], // Notion attachments are handled separately
    },
  ];
}

const notionNormalizer = new NotionNormalizer();
const airtableNormalizer = new AirtableNormalizer();

// A Notion extract is one page; an Airtable extract is a whole table (table + its records).
// Google Sheets has no normaliser yet, so it is left out and fails with a clear error.
const normalizers: Partial<Record<Platform, PlatformNormalizer>> = {
  notion: singleEntity(notionNormalizer),
  airtable: (raw) => airtableNormalizer.normalizeTable(raw),
};

export class UniversalNormalizer implements IUniversalNormalizer {
  normalize(raw: RawEntity, platform: Platform): NormalizedResult[] {
    const normalizer = normalizers[platform];
    if (!normalizer) {
      throw new Error(`No normalizer found for platform: ${platform}`);
    }

    return normalizer(raw);
  }
}

export const universalNormalizer = new UniversalNormalizer();
