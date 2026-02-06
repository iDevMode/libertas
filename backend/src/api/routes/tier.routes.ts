import { FastifyInstance } from 'fastify';
import { TIER_CONFIG } from '../../common/tier-config.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { prisma } from '../../common/database.js';
import { SubscriptionTier } from '../../common/types.js';
import { getTierLimits, isUnlimited } from '../../common/tier-config.js';

export async function tierRoutes(app: FastifyInstance): Promise<void> {
  // Get all pricing tiers (public)
  app.get('/', async (_request, reply) => {
    const tiers = Object.values(TIER_CONFIG).map((tier) => ({
      name: tier.name,
      displayName: tier.displayName,
      price: tier.price,
      billingPeriod: tier.billingPeriod,
      description: tier.description,
      highlights: tier.highlights,
      limits: {
        recordsPerExport: tier.limits.recordsPerExport,
        exportsPerMonth: tier.limits.exportsPerMonth,
        connectedAccountsPerPlatform: tier.limits.connectedAccountsPerPlatform,
        concurrentJobs: tier.limits.concurrentJobs,
        includeAttachments: tier.limits.includeAttachments,
        exportHistoryDays: tier.limits.exportHistoryDays,
        allowedDestinations: tier.limits.allowedDestinations,
        allowCellEditing: tier.limits.allowCellEditing,
      },
    }));

    reply.send({
      success: true,
      data: { tiers },
    });
  });

  // Get current user's tier usage
  app.get('/usage', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const tier = request.user!.tier as SubscriptionTier;
    const limits = getTierLimits(tier);

    // Count exports this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const exportsThisMonth = await prisma.migrationJob.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
    });

    // Count running jobs
    const runningJobs = await prisma.migrationJob.count({
      where: {
        userId,
        status: { in: ['pending', 'running'] },
      },
    });

    // Count connected accounts per platform
    const connections = await prisma.connectedAccount.groupBy({
      by: ['platform'],
      where: { userId },
      _count: { id: true },
    });

    const connectionsPerPlatform: Record<string, number> = {};
    for (const conn of connections) {
      connectionsPerPlatform[conn.platform] = conn._count.id;
    }

    reply.send({
      success: true,
      data: {
        tier,
        limits: {
          recordsPerExport: limits.recordsPerExport,
          exportsPerMonth: limits.exportsPerMonth,
          connectedAccountsPerPlatform: limits.connectedAccountsPerPlatform,
          concurrentJobs: limits.concurrentJobs,
          includeAttachments: limits.includeAttachments,
          allowCellEditing: limits.allowCellEditing,
        },
        usage: {
          exportsThisMonth,
          exportsRemaining: isUnlimited(limits.exportsPerMonth)
            ? -1
            : Math.max(0, limits.exportsPerMonth - exportsThisMonth),
          runningJobs,
          connectionsPerPlatform,
        },
      },
    });
  });
}
