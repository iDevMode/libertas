import { Platform } from '../common/types.js';
import { RawEntity } from '../connectors/interfaces.js';
import { INormalizer, IUniversalNormalizer, NormalizedResult } from './interfaces.js';
import { NotionNormalizer } from '../connectors/notion/notion.normalizer.js';

const normalizers: Record<Platform, INormalizer> = {
  notion: new NotionNormalizer(),
  airtable: new NotionNormalizer(), // TODO: Implement AirtableNormalizer
  google_sheets: new NotionNormalizer(), // TODO: Implement GoogleSheetsNormalizer
};

export class UniversalNormalizer implements IUniversalNormalizer {
  normalize(raw: RawEntity, platform: Platform): NormalizedResult {
    const normalizer = normalizers[platform];
    if (!normalizer) {
      throw new Error(`No normalizer found for platform: ${platform}`);
    }

    return {
      entity: normalizer.normalizeEntity(raw),
      properties: normalizer.normalizeProperties(raw),
      relations: normalizer.normalizeRelations(raw),
      contentBlocks: normalizer.normalizeContentBlocks(raw),
      attachments: [], // Attachments are handled separately
    };
  }
}

export const universalNormalizer = new UniversalNormalizer();
