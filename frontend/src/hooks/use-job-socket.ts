'use client';

import { useEffect, useCallback, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useJobsStore } from '@/stores/jobs.store';
import {
  initializeSocket,
  disconnectSocket,
  onJobProgress,
  onJobStatus,
  subscribeToJob,
  unsubscribeFromJob,
  isConnected,
} from '@/lib/socket';

export function useJobSocket() {
  const { token } = useAuthStore();
  const { updateJobProgress, updateJobStatus, fetchJob } = useJobsStore();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setConnected(false);
      return;
    }

    const socket = initializeSocket(token);

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Handle job progress updates
    const removeProgressHandler = onJobProgress((data) => {
      updateJobProgress(data.jobId, data.progress, data.recordsProcessed);
    });

    // Handle job status updates
    const removeStatusHandler = onJobStatus((data) => {
      // updateJobStatus already checks for removed jobs
      updateJobStatus(data.jobId, data.status, data.errorMessage);
      // Note: fetchJob also checks for removed jobs, so this is safe
      if (data.status === 'completed' || data.status === 'failed') {
        fetchJob(data.jobId);
      }
    });

    return () => {
      removeProgressHandler();
      removeStatusHandler();
    };
  }, [token, updateJobProgress, updateJobStatus, fetchJob]);

  const subscribe = useCallback((jobId: string) => {
    subscribeToJob(jobId);
  }, []);

  const unsubscribe = useCallback((jobId: string) => {
    unsubscribeFromJob(jobId);
  }, []);

  return {
    connected,
    isConnected: isConnected,
    subscribeToJob: subscribe,
    unsubscribeFromJob: unsubscribe,
  };
}

// Hook for subscribing to a specific job's updates
export function useJobSubscription(jobId: string | null) {
  const { connected, subscribeToJob, unsubscribeFromJob } = useJobSocket();

  useEffect(() => {
    if (!jobId || !connected) return;

    subscribeToJob(jobId);

    return () => {
      unsubscribeFromJob(jobId);
    };
  }, [jobId, connected, subscribeToJob, unsubscribeFromJob]);
}
