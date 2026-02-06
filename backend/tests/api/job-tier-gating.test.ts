import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

// Set up mocks before dynamic imports
const mockPrisma = {
  connectedAccount: {
    findFirst: jest.fn(),
  },
  migrationJob: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAuthService = {
  validateToken: jest.fn(),
};

const mockMigrationQueue = {
  add: jest.fn(),
  getJobs: jest.fn().mockResolvedValue([]),
};

jest.unstable_mockModule('../../src/common/database.js', () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  authService: mockAuthService,
}));

jest.unstable_mockModule('../../src/jobs/queue.js', () => ({
  migrationQueue: mockMigrationQueue,
}));

jest.unstable_mockModule('../../src/websocket/socket.js', () => ({
  emitJobStatus: jest.fn(),
}));

jest.unstable_mockModule('../../src/common/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Dynamic imports after mocks are set up
const { default: Fastify } = await import('fastify');
const { jobRoutes } = await import('../../src/api/routes/job.routes.js');

function createToken(payload: { sub: string; email: string; tier: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64');
  return `${header}.${body}.fake-signature`;
}

const COMMUNITY_USER = { id: 'user-1', email: 'free@test.com', tier: 'community' as const };
const PRO_USER = { id: 'user-2', email: 'pro@test.com', tier: 'pro' as const };

const VALID_JOB_BODY = {
  connectionId: '00000000-0000-0000-0000-000000000001',
  selectedEntities: ['entity-1'],
  destinationType: 'relational_sqlite',
  includeAttachments: false,
};

const MOCK_CONNECTION = {
  id: '00000000-0000-0000-0000-000000000001',
  userId: 'user-1',
  platform: 'notion',
};

describe('Job routes - tier gating', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(async (instance) => {
      await jobRoutes(instance);
    }, { prefix: '/api/jobs' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 403 when community user requests relational_sqlite export', async () => {
    const token = createToken({ sub: COMMUNITY_USER.id, email: COMMUNITY_USER.email, tier: 'community' });
    mockAuthService.validateToken.mockResolvedValue(COMMUNITY_USER);

    mockPrisma.connectedAccount.findFirst.mockResolvedValue({
      ...MOCK_CONNECTION,
      userId: COMMUNITY_USER.id,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      headers: { authorization: `Bearer ${token}` },
      payload: VALID_JOB_BODY,
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('Pro subscription');
  });

  it('should allow pro user to request relational_sqlite export', async () => {
    const token = createToken({ sub: PRO_USER.id, email: PRO_USER.email, tier: 'pro' });
    mockAuthService.validateToken.mockResolvedValue(PRO_USER);

    mockPrisma.connectedAccount.findFirst.mockResolvedValue({
      ...MOCK_CONNECTION,
      userId: PRO_USER.id,
    });

    const mockJob = {
      id: 'job-1',
      userId: PRO_USER.id,
      sourcePlatform: 'notion',
      destinationType: 'relational_sqlite',
      status: 'pending',
      progress: 0,
      recordsTotal: 1,
      recordsProcessed: 0,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      errorMessage: null,
    };

    mockPrisma.migrationJob.create.mockResolvedValue(mockJob);
    mockMigrationQueue.add.mockResolvedValue({});

    const response = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ...VALID_JOB_BODY,
        connectionId: MOCK_CONNECTION.id,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.destinationType).toBe('relational_sqlite');
  });

  it('should allow community user to request sqlite (non-pro) export', async () => {
    const token = createToken({ sub: COMMUNITY_USER.id, email: COMMUNITY_USER.email, tier: 'community' });
    mockAuthService.validateToken.mockResolvedValue(COMMUNITY_USER);

    mockPrisma.connectedAccount.findFirst.mockResolvedValue({
      ...MOCK_CONNECTION,
      userId: COMMUNITY_USER.id,
    });

    const mockJob = {
      id: 'job-2',
      userId: COMMUNITY_USER.id,
      sourcePlatform: 'notion',
      destinationType: 'sqlite',
      status: 'pending',
      progress: 0,
      recordsTotal: 1,
      recordsProcessed: 0,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      errorMessage: null,
    };

    mockPrisma.migrationJob.create.mockResolvedValue(mockJob);
    mockMigrationQueue.add.mockResolvedValue({});

    const response = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ...VALID_JOB_BODY,
        destinationType: 'sqlite',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.destinationType).toBe('sqlite');
  });
});
