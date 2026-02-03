import { Worker, Job } from 'bullmq';
import { redis } from '../common/redis.js';
import { prisma } from '../common/database.js';
import { logger } from '../common/logger.js';
import { config } from '../common/config.js';
import { MigrationJobData } from './queue.js';
import { ConnectorFactory } from '../connectors/index.js';
import { universalNormalizer } from '../transformers/index.js';
import { SQLiteAdapter } from '../destinations/sqlite.adapter.js';
import { Platform } from '../common/types.js';
import { join } from 'path';
import { mkdir } from 'fs/promises';

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

    // Initialize destination
    const outputDir = join(config.exportDir, userId);
    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${jobId}.db`);

    const destination = new SQLiteAdapter();
    await destination.connect({ type: 'sqlite', filepath: outputPath });
    await destination.createSchema();

    // Start transaction
    const transaction = await destination.beginTransaction();

    try {
      const selectedEntities = migrationJob.selectedEntities as string[];
      let processed = 0;
      const total = selectedEntities.length;

      // Extract and process each entity
      for await (const rawEntity of connector.extractBatch(token, selectedEntities)) {
        // Check if job was cancelled
        const currentJob = await prisma.migrationJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });

        if (currentJob?.status === 'cancelled') {
          await destination.rollback(transaction);
          logger.info({ jobId }, 'Job cancelled during processing');
          return;
        }

        // Normalize entity
        const normalized = universalNormalizer.normalize(rawEntity, sourceAccount.platform as Platform);

        // Write to destination
        await destination.writeEntities([normalized.entity]);
        await destination.writeProperties(normalized.properties);
        await destination.writeRelations(normalized.relations);
        await destination.writeContentBlocks(normalized.contentBlocks);
        await destination.writeAttachments(normalized.attachments);

        // Update progress
        processed++;
        const progress = Math.floor((processed / total) * 100);

        await prisma.migrationJob.update({
          where: { id: jobId },
          data: {
            progress,
            recordsProcessed: processed,
          },
        });

        // Update BullMQ job progress for real-time updates
        await job.updateProgress(progress);

        logger.debug({ jobId, processed, total, progress }, 'Job progress');
      }

      // Commit transaction
      await destination.commit(transaction);

      // Mark job as completed
      await prisma.migrationJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          progress: 100,
          recordsProcessed: processed,
          completedAt: new Date(),
          outputPath,
        },
      });

      logger.info({ jobId, processed }, 'Migration job completed');
    } catch (error) {
      await destination.rollback(transaction);
      throw error;
    } finally {
      await destination.disconnect();
    }
  } catch (error) {
    logger.error({ jobId, error: (error as Error).message }, 'Migration job failed');

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: (error as Error).message,
      },
    });

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
