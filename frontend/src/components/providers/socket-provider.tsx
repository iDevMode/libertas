'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { initializeSocket, disconnectSocket } from '@/lib/socket';
import { useJobsStore } from '@/stores/jobs.store';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  // Use refs to avoid re-creating event handlers on every render
  const handlersRef = useRef<{
    handleProgress: ((data: {
      jobId: string;
      progress: number;
      recordsProcessed: number;
      recordsTotal?: number | null;
    }) => void) | null;
    handleStatus: ((data: {
      jobId: string;
      status: string;
      errorMessage?: string;
    }) => void) | null;
  }>({ handleProgress: null, handleStatus: null });

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }

    const socket = initializeSocket(token);

    // Create handlers that access store directly to avoid stale closures
    const handleProgress = (data: {
      jobId: string;
      progress: number;
      recordsProcessed: number;
      recordsTotal?: number | null;
    }) => {
      const { updateJobProgress } = useJobsStore.getState();
      updateJobProgress(data.jobId, data.progress, data.recordsProcessed, data.recordsTotal);
    };

    const handleStatus = (data: {
      jobId: string;
      status: string;
      errorMessage?: string;
    }) => {
      const { updateJobStatus, fetchJob } = useJobsStore.getState();
      updateJobStatus(data.jobId, data.status, data.errorMessage);
      // Fetch full job details when status changes to terminal state
      if (data.status === 'completed' || data.status === 'failed') {
        fetchJob(data.jobId);
      }
    };

    handlersRef.current = { handleProgress, handleStatus };

    socket.on('job:progress', handleProgress);
    socket.on('job:status', handleStatus);

    return () => {
      socket.off('job:progress', handleProgress);
      socket.off('job:status', handleStatus);
    };
  }, [token]); // Only re-run when token changes

  return <>{children}</>;
}
