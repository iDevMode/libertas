import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  IdMapConflictError,
  IdMapStateError,
  IIdMapStore,
  MemoryIdMapStore,
  SqliteIdMapStore,
} from '../../src/migration';

const RUN = 'run-1';
let tempDir: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'libertas-idmap-'));
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

let fileCounter = 0;
const factories: Array<[string, () => IIdMapStore]> = [
  ['MemoryIdMapStore', () => new MemoryIdMapStore()],
  ['SqliteIdMapStore', () => new SqliteIdMapStore(join(tempDir, `store-${++fileCounter}.db`))],
];

describe.each(factories)('%s', (_name, createStore) => {
  let store: IIdMapStore;

  beforeEach(() => {
    store = createStore();
  });

  afterEach(() => {
    store.close();
  });

  it('registers a source object as pending', () => {
    const mapping = store.reserve(RUN, 'entity', 'recA');
    expect(mapping).toMatchObject({
      runId: RUN,
      kind: 'entity',
      sourceId: 'recA',
      status: 'pending',
      attempts: 0,
    });
    expect(store.getTargetId(RUN, 'entity', 'recA')).toBeUndefined();
  });

  it('leaves an existing mapping alone when reserved again', () => {
    store.markCreated(RUN, 'entity', 'recA', 'page-1');
    expect(store.reserve(RUN, 'entity', 'recA')).toMatchObject({
      status: 'created',
      targetId: 'page-1',
    });
  });

  it('records the destination ID once created, in both directions', () => {
    store.reserve(RUN, 'entity', 'recA');
    const mapping = store.markCreated(RUN, 'entity', 'recA', 'page-1');

    expect(mapping).toMatchObject({ status: 'created', targetId: 'page-1', attempts: 1 });
    expect(store.getTargetId(RUN, 'entity', 'recA')).toBe('page-1');
    expect(store.getSourceId(RUN, 'entity', 'page-1')).toBe('recA');
  });

  it('can create a mapping without reserving it first', () => {
    store.markCreated(RUN, 'database', 'app/tbl', 'db-1');
    expect(store.getTargetId(RUN, 'database', 'app/tbl')).toBe('db-1');
  });

  it('treats a repeated identical create as a no-op, so retries are safe', () => {
    store.markCreated(RUN, 'entity', 'recA', 'page-1');
    const again = store.markCreated(RUN, 'entity', 'recA', 'page-1');
    expect(again).toMatchObject({ targetId: 'page-1', attempts: 1 });
  });

  it('refuses to map one source to two destination objects', () => {
    store.markCreated(RUN, 'entity', 'recA', 'page-1');
    expect(() => store.markCreated(RUN, 'entity', 'recA', 'page-2')).toThrow(IdMapConflictError);
    expect(store.getTargetId(RUN, 'entity', 'recA')).toBe('page-1');
  });

  it('refuses to map two sources to one destination object', () => {
    store.markCreated(RUN, 'entity', 'recA', 'page-1');
    expect(() => store.markCreated(RUN, 'entity', 'recB', 'page-1')).toThrow(IdMapConflictError);
    expect(store.get(RUN, 'entity', 'recB')).toBeUndefined();
  });

  it('records failures and clears them on a later success', () => {
    store.markFailed(RUN, 'entity', 'recA', 'rate limited');
    expect(store.get(RUN, 'entity', 'recA')).toMatchObject({
      status: 'failed',
      error: 'rate limited',
      attempts: 1,
    });

    const created = store.markCreated(RUN, 'entity', 'recA', 'page-1');
    expect(created).toMatchObject({ status: 'created', attempts: 2 });
    expect(created.error).toBeUndefined();
  });

  it('refuses to mark a created object as failed', () => {
    store.markCreated(RUN, 'entity', 'recA', 'page-1');
    expect(() => store.markFailed(RUN, 'entity', 'recA', 'oops')).toThrow(IdMapStateError);
  });

  it('keeps kinds separate, so a record and a file may share a source ID', () => {
    store.markCreated(RUN, 'entity', 'x', 'page-1');
    store.markCreated(RUN, 'attachment', 'x', 'file-1');
    expect(store.getTargetId(RUN, 'entity', 'x')).toBe('page-1');
    expect(store.getTargetId(RUN, 'attachment', 'x')).toBe('file-1');
  });

  it('keeps runs separate', () => {
    store.markCreated(RUN, 'entity', 'recA', 'page-1');
    store.markCreated('run-2', 'entity', 'recA', 'page-1');
    expect(store.list('run-2')).toHaveLength(1);
    expect(store.getTargetId('run-3', 'entity', 'recA')).toBeUndefined();
  });

  it('lists and summarises a run by kind and status', () => {
    store.reserve(RUN, 'entity', 'recA');
    store.markCreated(RUN, 'entity', 'recB', 'page-2');
    store.markFailed(RUN, 'entity', 'recC', 'boom');
    store.markCreated(RUN, 'database', 'tbl', 'db-1');
    store.reserve(RUN, 'attachment', 'att1');

    expect(
      store
        .list(RUN, { status: 'created' })
        .map((m) => m.sourceId)
        .sort()
    ).toEqual(['recB', 'tbl']);
    expect(store.list(RUN, { kind: 'entity', status: 'failed' })).toHaveLength(1);
    expect(store.summary(RUN)).toEqual({
      total: 5,
      byStatus: { pending: 2, created: 2, failed: 1 },
      byKind: {
        entity: { pending: 1, created: 1, failed: 1 },
        database: { pending: 0, created: 1, failed: 0 },
        attachment: { pending: 1, created: 0, failed: 0 },
      },
    });
  });

  it('summarises an unknown run as empty', () => {
    expect(store.summary('nope')).toEqual({
      total: 0,
      byStatus: { pending: 0, created: 0, failed: 0 },
      byKind: {},
    });
  });
});

describe('SqliteIdMapStore persistence', () => {
  it('lets an interrupted run resume from where it stopped', () => {
    const file = join(tempDir, 'resume.db');

    const first = new SqliteIdMapStore(file);
    first.markCreated(RUN, 'entity', 'recA', 'page-1');
    first.markFailed(RUN, 'entity', 'recB', 'network error');
    first.reserve(RUN, 'entity', 'recC');
    first.close();

    const resumed = new SqliteIdMapStore(file);
    expect(resumed.getTargetId(RUN, 'entity', 'recA')).toBe('page-1');
    expect(resumed.list(RUN, { status: 'created' })).toHaveLength(1);
    expect(
      resumed
        .list(RUN)
        .filter((m) => m.status !== 'created')
        .map((m) => m.sourceId)
    ).toEqual(['recB', 'recC']);
    expect(resumed.get(RUN, 'entity', 'recA')?.updatedAt).toBeInstanceOf(Date);
    resumed.close();
  });
});
