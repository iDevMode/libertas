import { Queue } from 'bullmq';
import { redis } from '../common/redis.js';
import { logger } from '../common/logger.js';

export interface MigrationJobData {
  jobId: string;
  userId: string;
}

export const migrationQueue = new Queue<MigrationJobData>('migration-jobs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
});

migrationQueue.on('error', (err) => {
  logger.error({ error: err }, 'Migration queue error');
});

logger.info('Migration queue initialized');
