import { UniversalNormalizer } from '../../src/transformers/universal.normalizer';
import { RECORDS, TABLE, rawTable } from '../fixtures/airtable/agency-base';

const normalizer = new UniversalNormalizer();

describe('UniversalNormalizer', () => {
  it('expands an Airtable table into the table and its records', () => {
    const results = normalizer.normalize(rawTable(TABLE.people), 'airtable');
    expect(results.map((r) => r.entity.entityType)).toEqual([
      'database',
      'record',
      'record',
      'record',
    ]);
    expect(results).toHaveLength(1 + RECORDS[TABLE.people].length);
  });

  it('keeps a Notion page as a single entity', () => {
    const page = {
      id: 'page-1',
      object: 'page',
      created_time: '2026-01-01T00:00:00.000Z',
      last_edited_time: '2026-01-02T00:00:00.000Z',
      archived: false,
      parent: { type: 'workspace', workspace: true },
      url: 'https://notion.so/page-1',
      properties: { Name: { id: 'title', type: 'title', title: [{ plain_text: 'Hello' }] } },
    };

    const results = normalizer.normalize(
      { id: 'page-1', type: 'page', rawData: page, extractedAt: new Date() },
      'notion'
    );

    expect(results).toHaveLength(1);
    expect(results[0].entity).toMatchObject({
      id: 'page-1',
      title: 'Hello',
      sourcePlatform: 'notion',
    });
    expect(results[0].attachments).toEqual([]);
  });

  it('fails clearly for platforms without a normaliser', () => {
    expect(() =>
      normalizer.normalize(
        { id: 's', type: 'sheet', rawData: {}, extractedAt: new Date() },
        'google_sheets'
      )
    ).toThrow('No normalizer found for platform: google_sheets');
  });
});
