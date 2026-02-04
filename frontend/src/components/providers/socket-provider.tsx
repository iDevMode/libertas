'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { initializeSocket, disconnectSocket } from '@/lib/socket';
import { useJobsStore } from '@/stores/jobs.store';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  const { updateJobProgress, updateJobStatus, fetchJob } = useJobsStore();

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }

    const socket = initializeSocket(token);

    const handleProgress = (data: {
      jobId: string;
      progress: number;
      recordsProcessed: number;
      recordsTotal?: number | null;
    }) => {
      updateJobProgress(data.jobId, data.progress, data.recordsProcessed, data.recordsTotal);
    };

    const handleStatus = (data: {
      jobId: string;
      status: string;
      errorMessage?: string;
    }) => {
      updateJobStatus(data.jobId, data.status, data.errorMessage);
      // Fetch full job details when status changes to terminal state
      if (data.status === 'completed' || data.status === 'failed') {
        fetchJob(data.jobId);
      }
    };

    socket.on('job:progress', handleProgress);
    socket.on('job:status', handleStatus);

    return () => {
      socket.off('job:progress', handleProgress);
      socket.off('job:status', handleStatus);
    };
  }, [token, updateJobProgress, updateJobStatus, fetchJob]);

  return <>{children}</>;
}
