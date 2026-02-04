import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

interface JobProgressData {
  jobId: string;
  progress: number;
  recordsProcessed: number;
  recordsTotal: number;
  status: string;
}

interface JobStatusData {
  jobId: string;
  status: string;
  errorMessage?: string;
  completedAt?: string;
}

type JobProgressHandler = (data: JobProgressData) => void;
type JobStatusHandler = (data: JobStatusData) => void;

const progressHandlers = new Set<JobProgressHandler>();
const statusHandlers = new Set<JobStatusHandler>();

export function initializeSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[WebSocket] Connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[WebSocket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[WebSocket] Connection error:', error.message);
  });

  socket.on('job:progress', (data: JobProgressData) => {
    progressHandlers.forEach((handler) => handler(data));
  });

  socket.on('job:status', (data: JobStatusData) => {
    statusHandlers.forEach((handler) => handler(data));
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToJob(jobId: string): void {
  if (socket?.connected) {
    socket.emit('subscribe:job', jobId);
  }
}

export function unsubscribeFromJob(jobId: string): void {
  if (socket?.connected) {
    socket.emit('unsubscribe:job', jobId);
  }
}

export function onJobProgress(handler: JobProgressHandler): () => void {
  progressHandlers.add(handler);
  return () => progressHandlers.delete(handler);
}

export function onJobStatus(handler: JobStatusHandler): () => void {
  statusHandlers.add(handler);
  return () => statusHandlers.delete(handler);
}

export function isConnected(): boolean {
  return socket?.connected || false;
}
