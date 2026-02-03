import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './common/config.js';
import { logger } from './common/logger.js';
import { authRoutes } from './api/routes/auth.routes.js';
import { connectionRoutes } from './api/routes/connection.routes.js';
import { jobRoutes } from './api/routes/job.routes.js';
import { exportRoutes } from './api/routes/export.routes.js';
import { healthRoutes } from './api/routes/health.routes.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { initializeJobWorkers } from './jobs/worker.js';

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: logger,
  });

  // Security middleware
  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // WebSocket support for real-time updates
  await app.register(websocket);

  // Error handling
  app.setErrorHandler(errorHandler);

  // Register routes
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(connectionRoutes, { prefix: '/api/connections' });
  await app.register(jobRoutes, { prefix: '/api/jobs' });
  await app.register(exportRoutes, { prefix: '/api/exports' });

  // Initialize job workers
  await initializeJobWorkers();

  // Start server
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`Server running on http://localhost:${config.port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

bootstrap();
