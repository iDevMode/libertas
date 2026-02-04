import { create } from 'zustand';
import { api, Job, CreateJobInput } from '@/lib/api';

interface JobsState {
  jobs: Job[];
  currentJob: Job | null;
  isLoading: boolean;
  error: string | null;
  // Track removed job IDs to prevent WebSocket from re-adding them
  removedJobIds: Set<string>;

  fetchJobs: (params?: { status?: string; limit?: number; offset?: number }) => Promise<void>;
  fetchJob: (jobId: string) => Promise<void>;
  createJob: (input: CreateJobInput) => Promise<Job | null>;
  cancelJob: (jobId: string) => Promise<boolean>;
  removeJob: (jobId: string) => void;
  deleteJob: (jobId: string) => Promise<boolean>;
  updateJobProgress: (jobId: string, progress: number, recordsProcessed: number, recordsTotal?: number | null) => void;
  updateJobStatus: (jobId: string, status: string, errorMessage?: string) => void;
  clearError: () => void;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,
  error: null,
  removedJobIds: new Set<string>(),

  fetchJobs: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const { items } = await api.getJobs(params);
      // Filter out jobs that were removed locally
      const { removedJobIds } = get();
      const filteredItems = items.filter((job) => !removedJobIds.has(job.id));
      set({ jobs: filteredItems, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchJob: async (jobId: string) => {
    // Don't fetch if job was removed
    const { removedJobIds } = get();
    if (removedJobIds.has(jobId)) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const job = await api.getJob(jobId);
      set({ currentJob: job, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createJob: async (input: CreateJobInput) => {
    set({ isLoading: true, error: null });
    try {
      const job = await api.createJob(input);
      set((state) => ({
        jobs: [job, ...state.jobs],
        currentJob: job,
        isLoading: false,
      }));
      return job;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return null;
    }
  },

  cancelJob: async (jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.cancelJob(jobId);
      // Remove the job from the list and track it as removed
      set((state) => {
        const newRemovedIds = new Set(state.removedJobIds);
        newRemovedIds.add(jobId);
        return {
          jobs: state.jobs.filter((j) => j.id !== jobId),
          currentJob: state.currentJob?.id === jobId ? null : state.currentJob,
          removedJobIds: newRemovedIds,
          isLoading: false,
        };
      });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  // Remove a job from the UI without cancelling (for completed/failed jobs)
  removeJob: (jobId: string) => {
    set((state) => {
      const newRemovedIds = new Set(state.removedJobIds);
      newRemovedIds.add(jobId);
      return {
        jobs: state.jobs.filter((j) => j.id !== jobId),
        currentJob: state.currentJob?.id === jobId ? null : state.currentJob,
        removedJobIds: newRemovedIds,
      };
    });
  },

  // Delete a job from the backend and remove from UI
  deleteJob: async (jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteJob(jobId);
      set((state) => {
        const newRemovedIds = new Set(state.removedJobIds);
        newRemovedIds.add(jobId);
        return {
          jobs: state.jobs.filter((j) => j.id !== jobId),
          currentJob: state.currentJob?.id === jobId ? null : state.currentJob,
          removedJobIds: newRemovedIds,
          isLoading: false,
        };
      });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  updateJobProgress: (jobId: string, progress: number, recordsProcessed: number, recordsTotal?: number | null) => {
    const { removedJobIds } = get();
    // Don't update removed jobs
    if (removedJobIds.has(jobId)) return;

    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              progress,
              recordsProcessed,
              recordsTotal: recordsTotal ?? j.recordsTotal,
            }
          : j
      ),
      currentJob:
        state.currentJob?.id === jobId
          ? {
              ...state.currentJob,
              progress,
              recordsProcessed,
              recordsTotal: recordsTotal ?? state.currentJob.recordsTotal,
            }
          : state.currentJob,
    }));
  },

  updateJobStatus: (jobId: string, status: string, errorMessage?: string) => {
    const { removedJobIds } = get();
    // Don't update removed jobs
    if (removedJobIds.has(jobId)) return;

    const completedUpdates = status === 'completed'
      ? { completedAt: new Date().toISOString(), progress: 100 }
      : {};

    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: status as Job['status'],
              errorMessage,
              ...completedUpdates,
            }
          : j
      ),
      currentJob:
        state.currentJob?.id === jobId
          ? {
              ...state.currentJob,
              status: status as Job['status'],
              errorMessage,
              ...completedUpdates,
            }
          : state.currentJob,
    }));
  },

  clearError: () => set({ error: null }),
}));
