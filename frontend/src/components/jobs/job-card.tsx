'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Job, api } from '@/lib/api';
import {
  formatRelativeTime,
  getPlatformDisplayName,
  getStatusColor,
} from '@/lib/utils';
import { useJobsStore } from '@/stores/jobs.store';
import { DownloadIcon, XIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { subscribeToJob, unsubscribeFromJob, isConnected } from '@/lib/socket';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const { cancelJob, deleteJob, isLoading } = useJobsStore();
  const [wsConnected, setWsConnected] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (confirm('Are you sure you want to cancel this export?')) {
      await cancelJob(job.id);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to remove this export from the list?')) {
      await deleteJob(job.id);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await api.downloadExport(job.id);
    } catch (error) {
      setDownloadError((error as Error).message);
    } finally {
      setIsDownloading(false);
    }
  };

  const isRunning = job.status === 'running' || job.status === 'pending';
  const isCompleted = job.status === 'completed';

  // Subscribe to WebSocket updates for running jobs
  useEffect(() => {
    if (!isRunning) return;

    // Check connection status periodically
    const checkConnection = () => setWsConnected(isConnected());
    checkConnection();
    const interval = setInterval(checkConnection, 1000);

    // Subscribe to this job's updates
    subscribeToJob(job.id);

    return () => {
      clearInterval(interval);
      unsubscribeFromJob(job.id);
    };
  }, [job.id, isRunning]);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">
            {job.sourcePlatform ? getPlatformDisplayName(job.sourcePlatform) : 'Data'} Export
          </h3>
          <p className="text-sm text-muted-foreground">
            {job.destinationType ? job.destinationType.toUpperCase() : 'Processing'} - Created{' '}
            {formatRelativeTime(job.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && wsConnected && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live
            </span>
          )}
          <span
            className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
              job.status
            )}`}
          >
            {job.status}
          </span>
        </div>
      </div>

      {isRunning && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Exporting...</span>
            <span>{job.recordsProcessed} records</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary animate-pulse"
              style={{
                width: job.progress > 0 ? `${job.progress}%` : '100%',
                animation: job.progress === 0 ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {job.status === 'pending' ? 'Waiting to start...' : 'Processing pages and content blocks...'}
          </p>
        </div>
      )}

      {job.errorMessage && (
        <p className="text-sm text-destructive mb-3">{job.errorMessage}</p>
      )}

      {downloadError && (
        <p className="text-sm text-destructive mb-3">{downloadError}</p>
      )}

      <div className="flex gap-2">
        {isCompleted && (
          <Button
            className="flex-1"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <DownloadIcon className="w-4 h-4 mr-2" />
            )}
            {isDownloading ? 'Downloading...' : 'Download'}
          </Button>
        )}

        {isCompleted && (
          <Link href={`/browse/${job.id}`}>
            <Button variant="outline" size="sm">
              Browse Data
            </Button>
          </Link>
        )}

        {isRunning && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <XIcon className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        )}

        {/* Delete button for completed, failed, or cancelled jobs */}
        {!isRunning && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isLoading}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
