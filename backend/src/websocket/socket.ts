import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import * as jwt from 'jsonwebtoken';
import { config } from '../common/config.js';
import { logger } from '../common/logger.js';

interface JwtPayload {
  userId: string;
  email: string;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

let io: SocketIOServer | null = null;

// Map of userId -> Set of socket IDs
const userSockets = new Map<string, Set<string>>();

// Map of jobId -> Set of socket IDs subscribed to that job
const jobSubscriptions = new Map<string, Set<string>>();

export function initializeSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
      socket.userId = payload.userId;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    logger.info({ socketId: socket.id, userId }, 'WebSocket client connected');

    // Track user's socket connections
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Join user's personal room for user-specific events
    socket.join(`user:${userId}`);

    // Handle job subscription
    socket.on('subscribe:job', (jobId: string) => {
      logger.debug({ socketId: socket.id, jobId }, 'Client subscribing to job');

      if (!jobSubscriptions.has(jobId)) {
        jobSubscriptions.set(jobId, new Set());
      }
      jobSubscriptions.get(jobId)!.add(socket.id);
      socket.join(`job:${jobId}`);
    });

    // Handle job unsubscription
    socket.on('unsubscribe:job', (jobId: string) => {
      logger.debug({ socketId: socket.id, jobId }, 'Client unsubscribing from job');

      jobSubscriptions.get(jobId)?.delete(socket.id);
      socket.leave(`job:${jobId}`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'WebSocket client disconnected');

      // Remove from user sockets
      userSockets.get(userId)?.delete(socket.id);
      if (userSockets.get(userId)?.size === 0) {
        userSockets.delete(userId);
      }

      // Remove from all job subscriptions
      jobSubscriptions.forEach((sockets, jobId) => {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          jobSubscriptions.delete(jobId);
        }
      });
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

// Emit job progress update to all subscribers
export function emitJobProgress(jobId: string, userId: string, data: {
  progress: number;
  recordsProcessed: number;
  recordsTotal: number;
  status: string;
}): void {
  if (!io) {
    logger.warn('Socket.IO not initialized, cannot emit job progress');
    return;
  }

  // Emit to job room (clients subscribed to this specific job)
  io.to(`job:${jobId}`).emit('job:progress', {
    jobId,
    ...data,
  });

  // Also emit to user room (for job list updates)
  io.to(`user:${userId}`).emit('job:progress', {
    jobId,
    ...data,
  });

  logger.debug({ jobId, userId, progress: data.progress }, 'Emitted job progress');
}

// Emit job status change
export function emitJobStatus(jobId: string, userId: string, data: {
  status: string;
  errorMessage?: string;
  completedAt?: Date;
}): void {
  if (!io) {
    logger.warn('Socket.IO not initialized, cannot emit job status');
    return;
  }

  io.to(`job:${jobId}`).emit('job:status', {
    jobId,
    ...data,
  });

  io.to(`user:${userId}`).emit('job:status', {
    jobId,
    ...data,
  });

  logger.debug({ jobId, userId, status: data.status }, 'Emitted job status change');
}

// Get count of connected clients
export function getConnectedClientsCount(): number {
  return io?.sockets.sockets.size || 0;
}
