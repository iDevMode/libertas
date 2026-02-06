import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { migrationQueue } from '../../jobs/queue.js';
import { logger } from '../../common/logger.js';
import { JobStatus, DestinationType, SubscriptionTier } from '../../common/types.js';
import { emitJobStatus } from '../../websocket/socket.js';
import { getTierLimits, isDestinationAllowed, isUnlimited } from '../../common/tier-config.js';

const createJobSchema = z.object({
  connectionId: z.string().uuid(),
  selectedEntities: z.array(z.string()),
  destinationType: z.enum(['sqlite', 'json', 'csv', 'markdown', 'relational_sqlite']),
  includeAttachments: z.boolean().default(false),
  options: z.record(z.unknown()).optional(),
});

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  // Create a new export job
  app.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const input = createJobSchema.parse(request.body);

      // Verify connection belongs to user
      const connection = await prisma.connectedAccount.findFirst({
        where: {
          id: input.connectionId,
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

      const tier = request.user!.tier as SubscriptionTier;
      const limits = getTierLimits(tier);

      // Check destination type allowed for tier
      if (!isDestinationAllowed(tier, input.destinationType as DestinationType)) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'TIER_LIMIT',
            message: `${input.destinationType} export requires a Pro or Enterprise subscription`,
          },
        });
        return;
      }

      // Check attachment permission
      if (input.includeAttachments && !limits.includeAttachments) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'TIER_LIMIT',
            message: 'File attachment export requires a Pro or Enterprise subscription',
          },
        });
        return;
      }

      // Check record limit per export
      if (!isUnlimited(limits.recordsPerExport) && input.selectedEntities.length > limits.recordsPerExport) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'TIER_LIMIT',
            message: `Your plan allows up to ${limits.recordsPerExport.toLocaleString()} records per export. Selected: ${input.selectedEntities.length.toLocaleString()}. Upgrade for higher limits.`,
          },
        });
        return;
      }

      // Check monthly export quota
      if (!isUnlimited(limits.exportsPerMonth)) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const exportsThisMonth = await prisma.migrationJob.count({
          where: {
            userId: request.user!.id,
            createdAt: { gte: startOfMonth },
          },
        });

        if (exportsThisMonth >= limits.exportsPerMonth) {
          reply.status(403).send({
            success: false,
            error: {
              code: 'TIER_LIMIT',
              message: `Monthly export limit reached (${limits.exportsPerMonth}). Upgrade for unlimited exports.`,
            },
          });
          return;
        }
      }

      // Check concurrent job limit
      const runningJobs = await prisma.migrationJob.count({
        where: {
          userId: request.user!.id,
          status: { in: ['pending', 'running'] },
        },
      });

      if (runningJobs >= limits.concurrentJobs) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'TIER_LIMIT',
            message: `Concurrent job limit reached (${limits.concurrentJobs}). Wait for current jobs to complete or upgrade your plan.`,
          },
        });
        return;
      }

      // Create job record
      const job = await prisma.migrationJob.create({
        data: {
          userId: request.user!.id,
          sourcePlatform: connection.platform,
          sourceAccountId: connection.id,
          selectedEntities: input.selectedEntities,
          destinationType: input.destinationType,
          destinationConfig: input.options || {},
          status: 'pending',
          recordsTotal: input.selectedEntities.length,
          options: {
            includeAttachments: input.includeAttachments,
          },
        },
      });

      // Add to queue
      await migrationQueue.add('migration', {
        jobId: job.id,
        userId: request.user!.id,
      });

      logger.info({ jobId: job.id, userId: request.user!.id }, 'Export job created');

      reply.status(201).send({
        success: true,
        data: {
          id: job.id,
          sourcePlatform: job.sourcePlatform,
          destinationType: job.destinationType,
          status: job.status,
          progress: job.progress,
          recordsTotal: job.recordsTotal,
          recordsProcessed: job.recordsProcessed,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: error.errors,
          },
        });
        return;
      }

      throw error;
    }
  });

  // List jobs for current user
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { status, limit = 20, offset = 0 } = request.query as {
      status?: JobStatus;
      limit?: number;
      offset?: number;
    };

    const where = {
      userId: request.user!.id,
      ...(status && { status }),
    };

    const [jobs, total] = await Promise.all([
      prisma.migrationJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
        select: {
          id: true,
          sourcePlatform: true,
          destinationType: true,
          status: true,
          progress: true,
          recordsTotal: true,
          recordsProcessed: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
        },
      }),
      prisma.migrationJob.count({ where }),
    ]);

    reply.send({
      success: true,
      data: {
        items: jobs,
        total,
        hasMore: offset + jobs.length < total,
      },
    });
  });

  // Get job details
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.migrationJob.findFirst({
      where: {
        id,
        userId: request.user!.id,
      },
    });

    if (!job) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found',
        },
      });
      return;
    }

    reply.send({
      success: true,
      data: {
        id: job.id,
        sourcePlatform: job.sourcePlatform,
        destinationType: job.destinationType,
        status: job.status,
        progress: job.progress,
        recordsTotal: job.recordsTotal,
        recordsProcessed: job.recordsProcessed,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
      },
    });
  });

  // Cancel a running job
  app.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.migrationJob.findFirst({
      where: {
        id,
        userId: request.user!.id,
      },
    });

    if (!job) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found',
        },
      });
      return;
    }

    if (job.status !== 'pending' && job.status !== 'running') {
      reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Can only cancel pending or running jobs',
        },
      });
      return;
    }

    // Try to remove from BullMQ queue if pending
    if (job.status === 'pending') {
      try {
        // Get all jobs in queue and find the one matching this jobId
        const waitingJobs = await migrationQueue.getJobs(['waiting', 'delayed']);
        for (const queueJob of waitingJobs) {
          if (queueJob.data.jobId === id) {
            await queueJob.remove();
            logger.info({ jobId: id, bullmqJobId: queueJob.id }, 'Removed pending job from queue');
            break;
          }
        }
      } catch (err) {
        logger.warn({ jobId: id, error: (err as Error).message }, 'Failed to remove job from queue');
      }
    }

    await prisma.migrationJob.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // Emit cancellation via WebSocket
    emitJobStatus(id, request.user!.id, { status: 'cancelled' });

    logger.info({ jobId: id }, 'Job cancelled');

    reply.send({
      success: true,
      data: { message: 'Job cancelled' },
    });
  });

  // Delete a job (for completed/failed/cancelled jobs)
  app.delete('/:id/delete', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.migrationJob.findFirst({
      where: {
        id,
        userId: request.user!.id,
      },
    });

    if (!job) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found',
        },
      });
      return;
    }

    // Only allow deleting completed, failed, or cancelled jobs
    if (job.status === 'pending' || job.status === 'running') {
      reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Cannot delete pending or running jobs. Cancel them first.',
        },
      });
      return;
    }

    // Delete the job record
    await prisma.migrationJob.delete({
      where: { id },
    });

    logger.info({ jobId: id }, 'Job deleted');

    reply.send({
      success: true,
      data: { message: 'Job deleted' },
    });
  });

  // Download job output
  app.get('/:id/download', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.migrationJob.findFirst({
      where: {
        id,
        userId: request.user!.id,
        status: 'completed',
      },
    });

    if (!job) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found or not completed',
        },
      });
      return;
    }

    if (!job.outputPath) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NO_OUTPUT',
          message: 'Job output not available',
        },
      });
      return;
    }

    // Return download URL or stream file
    reply.send({
      success: true,
      data: {
        downloadUrl: `/api/exports/${id}/file`,
        filename: `export-${job.sourcePlatform}-${job.id}.db`,
      },
    });
  });
}
