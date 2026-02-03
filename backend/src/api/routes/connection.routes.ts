import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { ConnectorFactory } from '../../connectors/index.js';
import { Platform } from '../../common/types.js';
import { logger } from '../../common/logger.js';

const connectSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

export async function connectionRoutes(app: FastifyInstance): Promise<void> {
  // List all connections for current user
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const connections = await prisma.connectedAccount.findMany({
      where: { userId: request.user!.id },
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        platformAccountName: true,
        connectedAt: true,
        lastSyncedAt: true,
        status: true,
      },
    });

    reply.send({
      success: true,
      data: connections,
    });
  });

  // Get OAuth authorization URL for a platform
  app.get('/:platform/authorize', { preHandler: [authenticate] }, async (request, reply) => {
    const { platform } = request.params as { platform: string };

    if (!ConnectorFactory.isSupported(platform)) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'UNSUPPORTED_PLATFORM',
          message: `Platform '${platform}' is not supported`,
        },
      });
      return;
    }

    const connector = ConnectorFactory.create(platform as Platform);
    const state = Buffer.from(JSON.stringify({
      userId: request.user!.id,
      platform,
      timestamp: Date.now(),
    })).toString('base64');

    const authUrl = connector.getAuthorizationUrl(state);

    reply.send({
      success: true,
      data: { authUrl, state },
    });
  });

  // OAuth callback - exchange code for token
  app.post('/:platform/connect', { preHandler: [authenticate] }, async (request, reply) => {
    const { platform } = request.params as { platform: string };

    if (!ConnectorFactory.isSupported(platform)) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'UNSUPPORTED_PLATFORM',
          message: `Platform '${platform}' is not supported`,
        },
      });
      return;
    }

    try {
      const input = connectSchema.parse(request.body);
      const connector = ConnectorFactory.create(platform as Platform);

      // Exchange code for token
      const token = await connector.authenticate({
        code: input.code,
        redirectUri: `${process.env.APP_URL}/api/auth/${platform}/callback`,
        state: input.state,
      });

      // Store connection
      const connection = await prisma.connectedAccount.upsert({
        where: {
          userId_platform_platformAccountId: {
            userId: request.user!.id,
            platform,
            platformAccountId: token.workspaceId || 'default',
          },
        },
        update: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          tokenExpiresAt: token.expiresAt,
          status: 'active',
        },
        create: {
          userId: request.user!.id,
          platform,
          platformAccountId: token.workspaceId || 'default',
          platformAccountName: token.workspaceName || platform,
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          tokenExpiresAt: token.expiresAt,
          status: 'active',
        },
      });

      logger.info({ userId: request.user!.id, platform, connectionId: connection.id }, 'Platform connected');

      reply.status(201).send({
        success: true,
        data: {
          id: connection.id,
          platform: connection.platform,
          platformAccountName: connection.platformAccountName,
          status: connection.status,
        },
      });
    } catch (error) {
      logger.error({ error, platform }, 'Failed to connect platform');

      reply.status(400).send({
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: (error as Error).message,
        },
      });
    }
  });

  // Disconnect a platform
  app.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const connection = await prisma.connectedAccount.findFirst({
      where: {
        id,
        userId: request.user!.id,
      },
    });

    if (!connection) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Connection not found',
        },
      });
      return;
    }

    await prisma.connectedAccount.delete({
      where: { id },
    });

    logger.info({ userId: request.user!.id, connectionId: id }, 'Platform disconnected');

    reply.send({
      success: true,
      data: { message: 'Disconnected successfully' },
    });
  });

  // Get schema/structure from connected platform
  app.get('/:id/schema', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { refresh } = request.query as { refresh?: string };

    const connection = await prisma.connectedAccount.findFirst({
      where: {
        id,
        userId: request.user!.id,
      },
    });

    if (!connection) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Connection not found',
        },
      });
      return;
    }

    // Check for cached schema first (unless refresh is requested)
    if (refresh !== 'true') {
      const cachedSchema = await prisma.sourceSchema.findUnique({
        where: { connectedAccountId: connection.id },
      });

      if (cachedSchema && cachedSchema.expiresAt && cachedSchema.expiresAt > new Date()) {
        reply.send({
          success: true,
          data: cachedSchema.schemaData,
        });
        return;
      }
    }

    try {
      const connector = ConnectorFactory.create(connection.platform as Platform);
      const schema = await connector.discoverSchema({
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken || undefined,
        expiresAt: connection.tokenExpiresAt || undefined,
        tokenType: 'Bearer',
      });

      // Cache the schema
      await prisma.sourceSchema.upsert({
        where: { connectedAccountId: connection.id },
        update: {
          schemaData: schema as object,
          extractedAt: new Date(),
        },
        create: {
          connectedAccountId: connection.id,
          platform: connection.platform,
          schemaData: schema as object,
        },
      });

      reply.send({
        success: true,
        data: schema,
      });
    } catch (error) {
      logger.error({ error, connectionId: id }, 'Failed to discover schema');

      // If API fails, try to return cached schema even if expired
      const cachedSchema = await prisma.sourceSchema.findUnique({
        where: { connectedAccountId: connection.id },
      });

      if (cachedSchema) {
        reply.send({
          success: true,
          data: cachedSchema.schemaData,
        });
        return;
      }

      reply.status(500).send({
        success: false,
        error: {
          code: 'SCHEMA_DISCOVERY_FAILED',
          message: (error as Error).message,
        },
      });
    }
  });
}
