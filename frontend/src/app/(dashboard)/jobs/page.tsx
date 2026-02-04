'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useJobsStore } from '@/stores/jobs.store';
import { Button } from '@/components/ui/button';
import { JobCard } from '@/components/jobs/job-card';
import { ArrowLeft, RefreshCw, WifiIcon, WifiOffIcon } from 'lucide-react';
import { isConnected as checkSocketConnected } from '@/lib/socket';

type StatusFilter = 'all' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function JobsPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const { jobs, fetchJobs, isLoading, error } = useJobsStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        router.push('/login');
        return;
      }
      fetchJobs();
    };
    init();
  }, [checkAuth, router, fetchJobs]);

  // Check WebSocket connection status
  useEffect(() => {
    const checkConnection = () => setWsConnected(checkSocketConnected());
    checkConnection();
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchJobs(statusFilter !== 'all' ? { status: statusFilter } : undefined);
  };

  const handleFilterChange = (status: StatusFilter) => {
    setStatusFilter(status);
    fetchJobs(status !== 'all' ? { status } : undefined);
  };

  const filteredJobs = statusFilter === 'all'
    ? jobs
    : jobs.filter((job) => job.status === statusFilter);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Export History</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your data exports
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-sm ${wsConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
              {wsConnected ? (
                <>
                  <WifiIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Live updates</span>
                </>
              ) : (
                <>
                  <WifiOffIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Connecting...</span>
                </>
              )}
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFilterChange(option.value)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                statusFilter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 border border-red-200 rounded-lg p-4 bg-red-50">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Jobs List */}
      {isLoading && jobs.length === 0 ? (
        <p className="text-muted-foreground">Loading exports...</p>
      ) : filteredJobs.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-4">
            {statusFilter === 'all'
              ? 'No exports yet. Start your first export from the dashboard.'
              : `No ${statusFilter} exports found.`}
          </p>
          {statusFilter === 'all' && (
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
