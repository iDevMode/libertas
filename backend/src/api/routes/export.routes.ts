import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/database.js';
import { authenticate } from '../middleware/auth.middleware.js';
import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  // List entities in an export
  app.get('/:jobId/entities', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { type, search, limit = 50, offset = 0 } = request.query as {
      type?: string;
      search?: string;
      limit?: number;
      offset?: number;
    };

    const job = await prisma.migrationJob.findFirst({
      where: {
        id: jobId,
        userId: request.user!.id,
        status: 'completed',
      },
    });

    if (!job || !job.outputPath) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Export not found or not completed',
        },
      });
      return;
    }

    try {
      const db = new Database(job.outputPath, { readonly: true });

      let query = 'SELECT * FROM entities WHERE 1=1';
      const params: (string | number)[] = [];

      if (type) {
        query += ' AND entity_type = ?';
        params.push(type);
      }

      if (search) {
        query += ' AND title LIKE ?';
        params.push(`%${search}%`);
      }

      query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(Math.min(limit, 100), offset);

      const entities = db.prepare(query).all(...params);

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count').replace(/ LIMIT .+$/, '');
      const { count } = db.prepare(countQuery).get(...params.slice(0, -2)) as { count: number };

      db.close();

      reply.send({
        success: true,
        data: {
          items: entities,
          total: count,
          hasMore: offset + entities.length < count,
        },
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: {
          code: 'READ_ERROR',
          message: 'Failed to read export file',
        },
      });
    }
  });

  // Get single entity with all properties and relations
  app.get('/:jobId/entities/:entityId', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId, entityId } = request.params as { jobId: string; entityId: string };

    const job = await prisma.migrationJob.findFirst({
      where: {
        id: jobId,
        userId: request.user!.id,
        status: 'completed',
      },
    });

    if (!job || !job.outputPath) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Export not found or not completed',
        },
      });
      return;
    }

    try {
      const db = new Database(job.outputPath, { readonly: true });

      const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId);

      if (!entity) {
        db.close();
        reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Entity not found',
          },
        });
        return;
      }

      const properties = db.prepare('SELECT * FROM properties WHERE entity_id = ? ORDER BY position').all(entityId);
      const relations = db.prepare('SELECT * FROM relations WHERE from_entity_id = ? OR to_entity_id = ?').all(entityId, entityId);
      const contentBlocks = db.prepare('SELECT * FROM content_blocks WHERE entity_id = ? ORDER BY position').all(entityId);
      const attachments = db.prepare('SELECT * FROM attachments WHERE entity_id = ?').all(entityId);

      db.close();

      reply.send({
        success: true,
        data: {
          entity,
          properties,
          relations,
          contentBlocks,
          attachments,
        },
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: {
          code: 'READ_ERROR',
          message: 'Failed to read export file',
        },
      });
    }
  });

  // Download export file
  app.get('/:jobId/file', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.migrationJob.findFirst({
      where: {
        id: jobId,
        userId: request.user!.id,
        status: 'completed',
      },
    });

    if (!job || !job.outputPath) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Export not found or not completed',
        },
      });
      return;
    }

    try {
      const fileStat = await stat(job.outputPath);
      const filename = `export-${job.sourcePlatform}-${job.id}.db`;

      reply.header('Content-Type', 'application/x-sqlite3');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', fileStat.size);

      return reply.send(createReadStream(job.outputPath));
    } catch {
      reply.status(404).send({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Export file not found',
        },
      });
    }
  });
}
