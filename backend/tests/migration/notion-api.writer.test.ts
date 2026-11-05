import {
  NOTION_WRITE_API_VERSION,
  NotionAmbiguousWriteError,
  NotionApiError,
  NotionApiWriter,
} from '../../src/migration';

interface Call {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

function respond(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Replaces fetch with a queue of responses and records every request. */
function mockNotion(...responses: Response[]): Call[] {
  const calls: Call[] = [];
  global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? 'GET',
      path: new URL(String(url)).pathname.replace('/v1', ''),
      headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = responses.shift();
    if (!next) throw new Error('No more mocked responses');
    return next;
  }) as unknown as typeof fetch;
  return calls;
}

const sleeps: number[] = [];
const writer = (options = {}) =>
  new NotionApiWriter('secret', {
    minIntervalMs: 0,
    sleep: async (ms) => void sleeps.push(ms),
    ...options,
  });

const originalFetch = global.fetch;
beforeEach(() => {
  sleeps.length = 0;
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('NotionApiWriter requests', () => {
  it('creates a database with its schema under a page, on the current API version', async () => {
    const calls = mockNotion(
      respond({ id: 'db-1', url: 'https://notion.so/db-1', data_sources: [{ id: 'ds-1' }] })
    );

    const created = await writer().createDatabase({
      parentPageId: 'page-1',
      title: 'Tasks',
      properties: { Title: { type: 'title', title: {} } },
    });

    expect(created).toEqual({
      databaseId: 'db-1',
      dataSourceId: 'ds-1',
      url: 'https://notion.so/db-1',
    });
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/databases',
      headers: {
        Authorization: 'Bearer secret',
        'Notion-Version': NOTION_WRITE_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: {
        parent: { type: 'page_id', page_id: 'page-1' },
        title: [{ type: 'text', text: { content: 'Tasks' } }],
        initial_data_source: { properties: { Title: { type: 'title', title: {} } } },
      },
    });
    expect(NOTION_WRITE_API_VERSION).toBe('2026-03-11');
  });

  it('looks up the data source when the create response is partial', async () => {
    const calls = mockNotion(
      respond({ object: 'database', id: 'db-1' }),
      respond({ id: 'db-1', data_sources: [{ id: 'ds-9' }] })
    );

    const created = await writer().createDatabase({
      parentPageId: 'p',
      title: 'T',
      properties: {},
    });

    expect(created.dataSourceId).toBe('ds-9');
    expect(calls[1]).toMatchObject({ method: 'GET', path: '/databases/db-1' });
  });

  it('fails clearly if a database has no data source', async () => {
    mockNotion(respond({ id: 'db-1' }), respond({ id: 'db-1', data_sources: [] }));
    await expect(
      writer().createDatabase({ parentPageId: 'p', title: 'T', properties: {} })
    ).rejects.toThrow('has no data source');
  });

  it('creates pages in a data source and updates their properties', async () => {
    const calls = mockNotion(respond({ id: 'page-9' }), respond({}), respond({}));
    const w = writer();

    expect(await w.createPage('ds-1', { Title: { title: [] } })).toEqual({ pageId: 'page-9' });
    await w.updatePageProperties('page-9', { Links: { relation: [{ id: 'page-2' }] } });
    await w.addDataSourceProperties('ds-1', { Links: { type: 'relation' } });

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /pages',
      'PATCH /pages/page-9',
      'PATCH /data_sources/ds-1',
    ]);
    expect(calls[0].body).toEqual({
      parent: { type: 'data_source_id', data_source_id: 'ds-1' },
      properties: { Title: { title: [] } },
    });
  });
});

describe('NotionApiWriter retries', () => {
  it('waits for Retry-After when rate limited, then retries', async () => {
    const calls = mockNotion(
      respond({ code: 'rate_limited' }, 429, { 'Retry-After': '2' }),
      respond({ id: 'page-1' })
    );

    await writer().createPage('ds', {});

    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it('reads the retry delay from the body when there is no header', async () => {
    mockNotion(
      respond({ code: 'rate_limited', additional_data: { retry_after: 3 } }, 429),
      respond({ id: 'p' })
    );
    await writer().createPage('ds', {});
    expect(sleeps).toEqual([3000]);
  });

  it('backs off when Notion is overloaded', async () => {
    const calls = mockNotion(respond({ code: 'service_overload' }, 529), respond({ id: 'p' }));
    await writer().createPage('ds', {});
    expect(calls).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
  });

  it('does not retry when access is blocked', async () => {
    const calls = mockNotion(
      respond(
        {
          code: 'rate_limited',
          rate_limit_reason: 'public_api_request_blocked',
          message: 'blocked',
        },
        429
      )
    );
    await expect(writer().createPage('ds', {})).rejects.toBeInstanceOf(NotionApiError);
    expect(calls).toHaveLength(1);
  });

  it('never repeats a write that hit a server error, since it may have been saved', async () => {
    const calls = mockNotion(respond({ message: 'unavailable' }, 503));
    await expect(writer().createPage('ds', {})).rejects.toBeInstanceOf(NotionAmbiguousWriteError);
    expect(calls).toHaveLength(1);
  });

  it('does repeat a read that hit a server error', async () => {
    const calls = mockNotion(
      respond({ id: 'db-1' }),
      respond({}, 502),
      respond({ id: 'db-1', data_sources: [{ id: 'ds-1' }] })
    );
    await writer().createDatabase({ parentPageId: 'p', title: 'T', properties: {} });
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'GET']);
  });

  it("reports validation errors with Notion's code and message", async () => {
    mockNotion(respond({ code: 'validation_error', message: 'Title is not a property' }, 400));
    await expect(writer().createPage('ds', {})).rejects.toThrow(
      'Notion API 400 validation_error: Title is not a property'
    );
  });

  it('gives up after the maximum number of retries', async () => {
    const limited = () => respond({ code: 'rate_limited' }, 429, { 'Retry-After': '1' });
    const calls = mockNotion(limited(), limited(), limited());
    await expect(writer({ maxRetries: 2 }).createPage('ds', {})).rejects.toThrow('429');
    expect(calls).toHaveLength(3);
  });

  it('spaces requests to stay under the rate limit', async () => {
    mockNotion(respond({ id: 'a' }), respond({ id: 'b' }));
    const w = writer({ minIntervalMs: 1000 });
    await Promise.all([w.createPage('ds', {}), w.createPage('ds', {})]);
    expect(sleeps.some((ms) => ms > 900)).toBe(true);
  });
});
