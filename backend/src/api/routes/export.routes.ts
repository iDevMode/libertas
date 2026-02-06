import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/database.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { SubscriptionTier } from '../../common/types.js';
import { getTierLimits } from '../../common/tier-config.js';
import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import { stat, readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import archiver from 'archiver';

// Helper to validate filename has no path traversal
function isSafeFilename(filename: string): boolean {
  return !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
}

// Helper to find a completed job owned by the user
async function findCompletedJob(jobId: string, userId: string) {
  return prisma.migrationJob.findFirst({
    where: {
      id: jobId,
      userId,
      status: 'completed',
    },
  });
}

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
      const destinationType = job.destinationType;

      // Handle different destination types
      if (fileStat.isDirectory()) {
        // For directory-based exports (JSON, CSV, Markdown), create a zip
        if (destinationType === 'json') {
          // JSON has a single file - serve it directly
          const jsonPath = join(job.outputPath, 'export.json');
          const jsonStat = await stat(jsonPath);
          const filename = `export-${job.sourcePlatform}-${job.id}.json`;

          reply.header('Content-Type', 'application/json');
          reply.header('Content-Disposition', `attachment; filename="${filename}"`);
          reply.header('Content-Length', jsonStat.size);

          return reply.send(createReadStream(jsonPath));
        } else {
          // CSV and Markdown - create a zip archive
          const filename = `export-${job.sourcePlatform}-${job.id}.zip`;

          reply.header('Content-Type', 'application/zip');
          reply.header('Content-Disposition', `attachment; filename="${filename}"`);

          const archive = archiver('zip', { zlib: { level: 9 } });

          archive.on('error', (err) => {
            throw err;
          });

          // Add all files from the output directory
          archive.directory(job.outputPath, false);
          archive.finalize();

          return reply.send(archive);
        }
      } else {
        // SQLite - single file
        const filename = `export-${job.sourcePlatform}-${job.id}.db`;

        reply.header('Content-Type', 'application/x-sqlite3');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        reply.header('Content-Length', fileStat.size);

        return reply.send(createReadStream(job.outputPath));
      }
    } catch (error) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Export file not found',
        },
      });
    }
  });

  // ===== Markdown endpoints =====

  // List markdown files
  app.get('/:jobId/markdown/files', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await findCompletedJob(jobId, request.user!.id);

    if (!job || !job.outputPath) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    try {
      const files = await readdir(job.outputPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      const items = await Promise.all(
        mdFiles.map(async (filename) => {
          const fileStat = await stat(join(job.outputPath!, filename));
          return { filename, size: fileStat.size };
        })
      );

      // Pin _index.md at top
      items.sort((a, b) => {
        if (a.filename === '_index.md') return -1;
        if (b.filename === '_index.md') return 1;
        return a.filename.localeCompare(b.filename);
      });

      reply.send({ success: true, data: { items } });
    } catch (error) {
      reply.status(500).send({ success: false, error: { code: 'READ_ERROR', message: 'Failed to read markdown files' } });
    }
  });

  // Get single markdown file content
  app.get('/:jobId/markdown/files/:filename', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId, filename } = request.params as { jobId: string; filename: string };

    if (!isSafeFilename(filename)) {
      reply.status(400).send({ success: false, error: { code: 'INVALID_FILENAME', message: 'Invalid filename' } });
      return;
    }

    const job = await findCompletedJob(jobId, request.user!.id);
    if (!job || !job.outputPath) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    try {
      const content = await readFile(join(job.outputPath, filename), 'utf-8');
      reply.send({ success: true, data: { content, filename } });
    } catch (error) {
      reply.status(404).send({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Markdown file not found' } });
    }
  });

  // ===== JSON endpoint =====

  app.get('/:jobId/json', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await findCompletedJob(jobId, request.user!.id);

    if (!job || !job.outputPath) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    try {
      const filePath = job.outputPath.endsWith('.json')
        ? job.outputPath
        : join(job.outputPath, 'export.json');

      const fileStat = await stat(filePath);
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB

      if (fileStat.size > MAX_SIZE) {
        // Read truncated
        const buffer = Buffer.alloc(MAX_SIZE);
        const fd = await import('fs').then(fs => fs.promises.open(filePath, 'r'));
        await fd.read(buffer, 0, MAX_SIZE, 0);
        await fd.close();
        const partial = buffer.toString('utf-8');

        reply.send({
          success: true,
          data: { data: JSON.parse(partial.substring(0, partial.lastIndexOf('}') + 1) || '{}'), size: fileStat.size, truncated: true },
        });
      } else {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        reply.send({ success: true, data: { data, size: fileStat.size, truncated: false } });
      }
    } catch (error) {
      reply.status(500).send({ success: false, error: { code: 'READ_ERROR', message: 'Failed to read JSON export' } });
    }
  });

  // ===== CSV endpoints =====

  // List CSV files
  app.get('/:jobId/csv/files', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await findCompletedJob(jobId, request.user!.id);

    if (!job || !job.outputPath) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    try {
      const files = await readdir(job.outputPath);
      const csvFiles = files.filter(f => f.endsWith('.csv'));

      const items = await Promise.all(
        csvFiles.map(async (filename) => {
          const content = await readFile(join(job.outputPath!, filename), 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());
          return { filename, rowCount: Math.max(0, lines.length - 1) }; // exclude header
        })
      );

      reply.send({ success: true, data: { items } });
    } catch (error) {
      reply.status(500).send({ success: false, error: { code: 'READ_ERROR', message: 'Failed to read CSV files' } });
    }
  });

  // Get CSV file data with pagination
  app.get('/:jobId/csv/files/:filename', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId, filename } = request.params as { jobId: string; filename: string };
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };

    if (!isSafeFilename(filename)) {
      reply.status(400).send({ success: false, error: { code: 'INVALID_FILENAME', message: 'Invalid filename' } });
      return;
    }

    const job = await findCompletedJob(jobId, request.user!.id);
    if (!job || !job.outputPath) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    try {
      const content = await readFile(join(job.outputPath, filename), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      if (lines.length === 0) {
        reply.send({ success: true, data: { headers: [], rows: [], total: 0, hasMore: false } });
        return;
      }

      const headers = parseCsvLine(lines[0]);
      const dataLines = lines.slice(1);
      const total = dataLines.length;
      const pageLines = dataLines.slice(Number(offset), Number(offset) + Number(limit));
      const rows = pageLines.map(line => parseCsvLine(line));

      reply.send({
        success: true,
        data: { headers, rows, total, hasMore: Number(offset) + rows.length < total },
      });
    } catch (error) {
      reply.status(404).send({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'CSV file not found' } });
    }
  });

  // ===== Relational SQLite endpoints =====

  // List tables in relational SQLite export
  app.get('/:jobId/relational/tables', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await findCompletedJob(jobId, request.user!.id);

    if (!job || !job.outputPath) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    try {
      const db = new Database(job.outputPath, { readonly: true });

      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all() as { name: string }[];

      const result = tables.map((t) => {
        const columns = db.prepare(`PRAGMA table_info("${t.name}")`).all() as { name: string; type: string }[];
        const { count } = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as { count: number };
        return {
          name: t.name,
          rowCount: count,
          columns: columns.map(c => ({ name: c.name, type: c.type })),
        };
      });

      db.close();
      reply.send({ success: true, data: { tables: result } });
    } catch (error) {
      reply.status(500).send({ success: false, error: { code: 'READ_ERROR', message: 'Failed to read relational database' } });
    }
  });

  // Get table data with sort/filter/pagination
  app.get('/:jobId/relational/tables/:tableName', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId, tableName } = request.params as { jobId: string; tableName: string };
    const { limit = 50, offset = 0, sort, order = 'asc', filter } = request.query as {
      limit?: number;
      offset?: number;
      sort?: string;
      order?: string;
      filter?: string;
    };

    const job = await findCompletedJob(jobId, request.user!.id);
    if (!job || !job.outputPath) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    try {
      const db = new Database(job.outputPath, { readonly: true });

      // Validate table name against sqlite_master
      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
      ).get(tableName);

      if (!tableExists) {
        db.close();
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Table not found' } });
        return;
      }

      // Get column info for validation
      const columnInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string; type: string }[];
      const validColumns = new Set(columnInfo.map(c => c.name));
      const columns = columnInfo.map(c => ({ name: c.name, type: c.type }));

      let query = `SELECT * FROM "${tableName}" WHERE 1=1`;
      const params: (string | number)[] = [];

      // Apply filters (format: "col:op:value")
      if (filter) {
        const filters = Array.isArray(filter) ? filter : [filter];
        for (const f of filters) {
          const parts = f.split(':');
          if (parts.length >= 3) {
            const col = parts[0];
            const op = parts[1];
            const val = parts.slice(2).join(':');

            if (!validColumns.has(col)) continue;

            switch (op) {
              case 'eq':
                query += ` AND "${col}" = ?`;
                params.push(val);
                break;
              case 'like':
                query += ` AND "${col}" LIKE ?`;
                params.push(`%${val}%`);
                break;
              case 'gt':
                query += ` AND "${col}" > ?`;
                params.push(Number(val));
                break;
              case 'lt':
                query += ` AND "${col}" < ?`;
                params.push(Number(val));
                break;
            }
          }
        }
      }

      // Count total before pagination
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
      const { count } = db.prepare(countQuery).get(...params) as { count: number };

      // Apply sort
      if (sort && validColumns.has(sort)) {
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY "${sort}" ${sortOrder}`;
      }

      // Apply pagination
      query += ' LIMIT ? OFFSET ?';
      params.push(Math.min(Number(limit), 100), Number(offset));

      const rows = db.prepare(query).all(...params);
      db.close();

      reply.send({
        success: true,
        data: { columns, rows, total: count, hasMore: Number(offset) + rows.length < count },
      });
    } catch (error) {
      reply.status(500).send({ success: false, error: { code: 'READ_ERROR', message: 'Failed to read table data' } });
    }
  });

  // Update a cell in relational SQLite table
  app.put('/:jobId/relational/tables/:tableName/:rowId', { preHandler: [authenticate] }, async (request, reply) => {
    const { jobId, tableName, rowId } = request.params as { jobId: string; tableName: string; rowId: string };
    const { column, value } = request.body as { column: string; value: unknown };

    // Check tier allows cell editing
    const tier = request.user!.tier as SubscriptionTier;
    const limits = getTierLimits(tier);
    if (!limits.allowCellEditing) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'TIER_LIMIT',
          message: 'Cell editing requires a Pro or Enterprise subscription',
        },
      });
      return;
    }

    const job = await findCompletedJob(jobId, request.user!.id);
    if (!job || !job.outputPath) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    try {
      const db = new Database(job.outputPath);

      // Validate table name
      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
      ).get(tableName);

      if (!tableExists) {
        db.close();
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Table not found' } });
        return;
      }

      // Validate column name
      const columnInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string }[];
      const validColumns = new Set(columnInfo.map(c => c.name));

      if (!validColumns.has(column)) {
        db.close();
        reply.status(400).send({ success: false, error: { code: 'INVALID_COLUMN', message: 'Column not found in table' } });
        return;
      }

      db.prepare(`UPDATE "${tableName}" SET "${column}" = ? WHERE id = ?`).run(value, rowId);
      const row = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ?`).get(rowId);

      db.close();
      reply.send({ success: true, data: { row } });
    } catch (error) {
      reply.status(500).send({ success: false, error: { code: 'WRITE_ERROR', message: 'Failed to update cell' } });
    }
  });
}

// Simple CSV line parser that handles quoted fields
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
