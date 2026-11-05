import { AirtableConnector } from '../../../src/connectors/airtable/airtable.connector';
import { AirtableTableExtract } from '../../../src/connectors/airtable/airtable.types';
import { AuthToken } from '../../../src/connectors/interfaces';
import { BASE_ID, FIELD, RECORDS, TABLE, TABLES } from '../../fixtures/airtable/agency-base';

/** Skips the real 30-second rate-limit wait. */
class TestAirtableConnector extends AirtableConnector {
  protected override rateLimitWaitMs = 0;
}

const token: AuthToken = { accessToken: 'test-token', tokenType: 'Bearer' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Route = (url: URL) => Response | undefined;

function mockFetch(...routes: Route[]): jest.Mock {
  const mock = jest.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    for (const route of routes) {
      const response = route(url);
      if (response) return response;
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

const tablesRoute: Route = (url) =>
  url.pathname === `/v0/meta/bases/${BASE_ID}/tables` ? json({ tables: TABLES }) : undefined;

/** Serves the Tasks records over two pages to exercise pagination. */
const pagedRecordsRoute: Route = (url) => {
  if (url.pathname !== `/v0/${BASE_ID}/${TABLE.tasks}`) return undefined;
  const all = RECORDS[TABLE.tasks];
  return url.searchParams.get('offset') === 'page2'
    ? json({ records: all.slice(4) })
    : json({ records: all.slice(0, 4), offset: 'page2' });
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('AirtableConnector.extractEntity', () => {
  it('returns every record across pages together with the table schema', async () => {
    const fetchMock = mockFetch(tablesRoute, pagedRecordsRoute);

    const raw = await new TestAirtableConnector().extractEntity(token, `${BASE_ID}/${TABLE.tasks}`);
    const data = raw.rawData as AirtableTableExtract;

    expect(raw).toMatchObject({ id: `${BASE_ID}/${TABLE.tasks}`, type: 'table' });
    expect(data.table?.name).toBe('Tasks');
    expect(data.records).toHaveLength(RECORDS[TABLE.tasks].length);
    expect(data.records[0].fields[FIELD.taskTitle]).toBe('Wireframes');

    const recordCalls = fetchMock.mock.calls
      .map(([u]) => new URL(String(u)))
      .filter((u) => u.pathname.endsWith(TABLE.tasks));
    expect(recordCalls).toHaveLength(2);
    expect(recordCalls.every((u) => u.searchParams.get('returnFieldsByFieldId') === 'true')).toBe(
      true
    );
  });

  it('sends the access token', async () => {
    const fetchMock = mockFetch(tablesRoute, pagedRecordsRoute);
    await new TestAirtableConnector().extractEntity(token, `${BASE_ID}/${TABLE.tasks}`);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ Authorization: 'Bearer test-token' });
  });

  it('still extracts records when the schema cannot be read', async () => {
    mockFetch(
      (url) =>
        url.pathname.includes('/meta/') ? json({ error: 'NOT_AUTHORIZED' }, 403) : undefined,
      pagedRecordsRoute
    );

    const raw = await new TestAirtableConnector().extractEntity(token, `${BASE_ID}/${TABLE.tasks}`);
    const data = raw.rawData as AirtableTableExtract;

    expect(data.table).toBeUndefined();
    expect(data.records).toHaveLength(RECORDS[TABLE.tasks].length);
  });

  it('waits and retries when Airtable rate-limits a request', async () => {
    let limited = 2;
    const fetchMock = mockFetch(
      tablesRoute,
      (url) =>
        url.pathname.endsWith(TABLE.tasks) && limited-- > 0 ? json({ errors: [] }, 429) : undefined,
      pagedRecordsRoute
    );

    const raw = await new TestAirtableConnector().extractEntity(token, `${BASE_ID}/${TABLE.tasks}`);

    expect((raw.rawData as AirtableTableExtract).records).toHaveLength(6);
    expect(fetchMock).toHaveBeenCalledTimes(1 + 2 + 2);
  });

  it('gives up after repeated rate limits', async () => {
    mockFetch(tablesRoute, (url) =>
      url.pathname.endsWith(TABLE.tasks) ? json({}, 429) : undefined
    );

    await expect(
      new TestAirtableConnector().extractEntity(token, `${BASE_ID}/${TABLE.tasks}`)
    ).rejects.toThrow('Airtable request failed (429)');
  });

  it('reports API errors with their message', async () => {
    mockFetch(tablesRoute, () =>
      json({ error: { type: 'TABLE_NOT_FOUND', message: 'Could not find table' } }, 404)
    );

    await expect(
      new TestAirtableConnector().extractEntity(token, `${BASE_ID}/${TABLE.tasks}`)
    ).rejects.toThrow('Airtable request failed (404): Could not find table');
  });

  it('rejects IDs that are not baseId/tableId', async () => {
    await expect(new TestAirtableConnector().extractEntity(token, BASE_ID)).rejects.toThrow(
      'must be "baseId/tableId"'
    );
  });
});

describe('AirtableConnector.discoverSchema', () => {
  it('lists every table of every base, with link targets as database IDs', async () => {
    mockFetch((url) => {
      if (url.pathname !== '/v0/meta/bases') return undefined;
      return url.searchParams.get('offset')
        ? json({ bases: [] })
        : json({ bases: [{ id: BASE_ID, name: 'Agency' }], offset: 'more' });
    }, tablesRoute);

    const schema = await new TestAirtableConnector().discoverSchema(token);

    expect(schema.databases.map((d) => d.title)).toEqual([
      'Agency / Clients',
      'Agency / Projects',
      'Agency / Tasks',
      'Agency / People',
      'Agency / Invoices',
    ]);
    const tasks = schema.databases.find((d) => d.id === `${BASE_ID}/${TABLE.tasks}`);
    expect(tasks?.properties.find((p) => p.name === 'Assignee')).toMatchObject({
      type: 'relation',
      relationTargetDatabaseId: `${BASE_ID}/${TABLE.people}`,
    });
    expect(tasks?.properties.find((p) => p.name === 'Tags')?.options).toHaveLength(3);
  });
});

describe('AirtableConnector OAuth', () => {
  const tokenBody = {
    access_token: 'a1',
    refresh_token: 'r1',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'data.records:read',
  };

  it('builds an authorisation URL with read-only scopes', () => {
    const url = new URL(new TestAirtableConnector().getAuthorizationUrl('state-123'));
    expect(url.origin + url.pathname).toBe('https://airtable.com/oauth2/v1/authorize');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('scope')).toContain('schema.bases:read');
  });

  it('exchanges an authorisation code for tokens', async () => {
    const fetchMock = mockFetch((url) =>
      url.pathname === '/oauth2/v1/token' ? json(tokenBody) : undefined
    );

    const result = await new TestAirtableConnector().authenticate({
      code: 'c',
      redirectUri: 'http://x',
      state: 'v',
    });

    expect(result).toMatchObject({ accessToken: 'a1', refreshToken: 'r1', tokenType: 'Bearer' });
    expect(result.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
  });

  it('reports a failed code exchange', async () => {
    mockFetch(() => json({ error: 'invalid_grant' }, 400));
    await expect(
      new TestAirtableConnector().authenticate({ code: 'c', redirectUri: 'http://x' })
    ).rejects.toThrow('Airtable authentication failed: invalid_grant');
  });

  it('refreshes tokens', async () => {
    mockFetch(() => json({ ...tokenBody, access_token: 'a2' }));
    const result = await new TestAirtableConnector().refreshToken({ ...token, refreshToken: 'r1' });
    expect(result.accessToken).toBe('a2');
  });

  it('refuses to refresh without a refresh token, or when Airtable rejects it', async () => {
    const connector = new TestAirtableConnector();
    await expect(connector.refreshToken(token)).rejects.toThrow('No refresh token available');

    mockFetch(() => json({}, 401));
    await expect(connector.refreshToken({ ...token, refreshToken: 'r1' })).rejects.toThrow(
      'Failed to refresh'
    );
  });

  it('has no revocation endpoint to call', async () => {
    const fetchMock = mockFetch();
    await new TestAirtableConnector().revokeToken(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('declares its limits and capabilities', () => {
    const connector = new TestAirtableConnector();
    expect(connector.getRateLimits().requestsPerSecond).toBe(5);
    expect(connector.getCapabilities()).toMatchObject({
      supportsRelations: true,
      supportsAttachments: true,
    });
  });
});

describe('AirtableConnector.listEntities', () => {
  it('lists bases as databases', async () => {
    mockFetch((url) =>
      url.pathname === '/v0/meta/bases'
        ? json({ bases: [{ id: BASE_ID, name: 'Agency' }] })
        : undefined
    );

    const list = await new TestAirtableConnector().listEntities(token);

    expect(list).toEqual({
      items: [{ id: BASE_ID, type: 'database', title: 'Agency' }],
      hasMore: false,
    });
  });
});
