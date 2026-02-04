import { Worker, Job } from 'bullmq';
import { redis } from '../common/redis.js';
import { prisma } from '../common/database.js';
import { logger } from '../common/logger.js';
import { config } from '../common/config.js';
import { MigrationJobData } from './queue.js';
import { ConnectorFactory } from '../connectors/index.js';
import { universalNormalizer } from '../transformers/index.js';
import {
  DestinationFactory,
  DestinationConfig,
  RelationalSQLiteAdapter,
  convertToRelationalSchema,
} from '../destinations/index.js';
import { Platform, DestinationType, PropertyType } from '../common/types.js';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { emitJobProgress, emitJobStatus } from '../websocket/socket.js';

async function processMigrationJob(job: Job<MigrationJobData>): Promise<void> {
  const { jobId, userId } = job.data;

  logger.info({ jobId, userId }, 'Starting migration job');

  // Get job details from database
  const migrationJob = await prisma.migrationJob.findUnique({
    where: { id: jobId },
    include: { sourceAccount: true },
  });

  if (!migrationJob) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (migrationJob.status === 'cancelled') {
    logger.info({ jobId }, 'Job was cancelled');
    return;
  }

  // Update status to running
  await prisma.migrationJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: new Date(),
    },
  });

  // Emit job started event
  emitJobStatus(jobId, userId, { status: 'running' });

  try {
    const { sourceAccount } = migrationJob;
    if (!sourceAccount) {
      throw new Error('Source account not found');
    }

    // Initialize connector
    const connector = ConnectorFactory.create(sourceAccount.platform as Platform);
    const token = {
      accessToken: sourceAccount.accessToken,
      refreshToken: sourceAccount.refreshToken || undefined,
      expiresAt: sourceAccount.tokenExpiresAt || undefined,
      tokenType: 'Bearer',
    };

    // Initialize destination based on job's destinationType
    const destinationType = migrationJob.destinationType as DestinationType;
    const outputDir = join(config.exportDir, userId, jobId);
    await mkdir(outputDir, { recursive: true });

    // Create the appropriate destination adapter
    const destination = DestinationFactory.create(destinationType);

    // Build config based on destination type
    let destinationConfig: DestinationConfig;
    let outputPath: string;

    switch (destinationType) {
      case 'sqlite':
        outputPath = join(outputDir, 'export.db');
        destinationConfig = { type: 'sqlite', filepath: outputPath };
        break;
      case 'relational_sqlite':
        outputPath = join(outputDir, 'export-relational.db');
        destinationConfig = { type: 'relational_sqlite', filepath: outputPath };
        break;
      case 'json':
        outputPath = join(outputDir, 'export.json');
        destinationConfig = {
          type: 'json',
          outputDir,
          prettyPrint: true,
        };
        break;
      case 'csv':
        outputPath = outputDir; // CSV creates multiple files
        destinationConfig = {
          type: 'csv',
          outputDir,
          delimiter: ',',
        };
        break;
      case 'markdown':
        outputPath = outputDir; // Markdown creates multiple files
        destinationConfig = {
          type: 'markdown',
          outputDir,
          includeFrontmatter: true,
        };
        break;
      default:
        throw new Error(`Unsupported destination type: ${destinationType}`);
    }

    await destination.connect(destinationConfig);

    // For relational_sqlite, we need to fetch database schemas first
    if (destinationType === 'relational_sqlite' && destination instanceof RelationalSQLiteAdapter) {
      logger.info({ jobId }, 'Fetching database schemas for relational export');

      // Fetch schema from source platform
      const sourceSchema = await connector.discoverSchema(token);

      // Convert to relational schemas for selected databases
      const selectedEntities = migrationJob.selectedEntities as string[];
      const relationalSchemas = sourceSchema.databases
        .filter(db => selectedEntities.includes(db.id))
        .map(db => convertToRelationalSchema(
          db.id,
          db.title,
          db.properties.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type as PropertyType,
            relationTargetDatabaseId: p.relationTargetDatabaseId,
          }))
        ));

      destination.setDatabaseSchemas(relationalSchemas);
      logger.info({ jobId, schemaCount: relationalSchemas.length }, 'Database schemas prepared');
    }

    await destination.createSchema();

    // Start transaction
    const transaction = await destination.beginTransaction();

    try {
      const selectedEntities = migrationJob.selectedEntities as string[];
      let processed = 0;
      let lastProgressUpdate = Date.now();
      const PROGRESS_UPDATE_INTERVAL = 500; // Update progress every 500ms max

      // Extract and process each entity (pages within selected databases)
      for await (const rawEntity of connector.extractBatch(token, selectedEntities)) {
        // Check if job was cancelled (throttled to avoid DB spam)
        if (Date.now() - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
          const currentJob = await prisma.migrationJob.findUnique({
            where: { id: jobId },
            select: { status: true },
          });

          if (currentJob?.status === 'cancelled') {
            await destination.rollback(transaction);
            logger.info({ jobId }, 'Job cancelled during processing');
            return;
          }
        }

        // Normalize entity
        const normalized = universalNormalizer.normalize(rawEntity, sourceAccount.platform as Platform);

        // Write to destination
        await destination.writeEntities([normalized.entity]);
        await destination.writeProperties(normalized.properties);
        await destination.writeRelations(normalized.relations);
        await destination.writeContentBlocks(normalized.contentBlocks);
        await destination.writeAttachments(normalized.attachments);

        // Update progress (throttled)
        processed++;
        const now = Date.now();
        if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
          lastProgressUpdate = now;

          await prisma.migrationJob.update({
            where: { id: jobId },
            data: {
              recordsProcessed: processed,
              recordsTotal: processed, // Update total as we discover records
            },
          });

          // Emit progress via WebSocket - show records processed without percentage
          emitJobProgress(jobId, userId, {
            progress: 0, // Unknown total, so no percentage
            recordsProcessed: processed,
            recordsTotal: null, // Unknown
            status: 'running',
          });

          logger.debug({ jobId, processed }, 'Job progress');
        }
      }

      // Commit transaction
      await destination.commit(transaction);

      // Mark job as completed
      const completedAt = new Date();
      await prisma.migrationJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          progress: 100,
          recordsProcessed: processed,
          recordsTotal: processed,
          completedAt,
          outputPath,
        },
      });

      // Emit job completed event
      emitJobStatus(jobId, userId, { status: 'completed', completedAt });
      emitJobProgress(jobId, userId, {
        progress: 100,
        recordsProcessed: processed,
        recordsTotal: processed,
        status: 'completed',
      });

      logger.info({ jobId, processed }, 'Migration job completed');
    } catch (error) {
      await destination.rollback(transaction);
      throw error;
    } finally {
      await destination.disconnect();
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error({ jobId, error: errorMessage }, 'Migration job failed');

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage,
      },
    });

    // Emit job failed event
    emitJobStatus(jobId, userId, { status: 'failed', errorMessage });

    throw error;
  }
}

let worker: Worker<MigrationJobData> | null = null;

export async function initializeJobWorkers(): Promise<void> {
  worker = new Worker<MigrationJobData>('migration-jobs', processMigrationJob, {
    connection: redis,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.data.jobId }, 'Job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.data.jobId, error: error.message }, 'Job failed');
  });

  worker.on('error', (error) => {
    logger.error({ error: error.message }, 'Worker error');
  });

  logger.info('Migration worker initialized');
}

export async function shutdownWorkers(): Promise<void> {
  if (worker) {
    await worker.close();
    logger.info('Migration worker shut down');
  }
}
