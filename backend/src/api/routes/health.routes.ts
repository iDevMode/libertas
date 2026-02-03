import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/database.js';
import { redis } from '../../common/redis.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'unknown',
      },
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.services.database = 'healthy';
    } catch {
      checks.services.database = 'unhealthy';
      checks.status = 'degraded';
    }

    try {
      await redis.ping();
      checks.services.redis = 'healthy';
    } catch {
      checks.services.redis = 'unhealthy';
      checks.status = 'degraded';
    }

    const statusCode = checks.status === 'ok' ? 200 : 503;
    reply.status(statusCode).send(checks);
  });

  app.get('/health/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      reply.send({ ready: true });
    } catch {
      reply.status(503).send({ ready: false });
    }
  });

  app.get('/health/live', async (_request, reply) => {
    reply.send({ alive: true });
  });
}
