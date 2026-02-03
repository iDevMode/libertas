import { create } from 'zustand';
import { api, Job, CreateJobInput } from '@/lib/api';

interface JobsState {
  jobs: Job[];
  currentJob: Job | null;
  isLoading: boolean;
  error: string | null;

  fetchJobs: (params?: { status?: string; limit?: number; offset?: number }) => Promise<void>;
  fetchJob: (jobId: string) => Promise<void>;
  createJob: (input: CreateJobInput) => Promise<Job | null>;
  cancelJob: (jobId: string) => Promise<boolean>;
  updateJobProgress: (jobId: string, progress: number, recordsProcessed: number) => void;
  clearError: () => void;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,
  error: null,

  fetchJobs: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const { items } = await api.getJobs(params);
      set({ jobs: items, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchJob: async (jobId: string) => {
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
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId ? { ...j, status: 'cancelled' as const } : j
        ),
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  updateJobProgress: (jobId: string, progress: number, recordsProcessed: number) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId ? { ...j, progress, recordsProcessed } : j
      ),
      currentJob:
        state.currentJob?.id === jobId
          ? { ...state.currentJob, progress, recordsProcessed }
          : state.currentJob,
    }));
  },

  clearError: () => set({ error: null }),
}));
