'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Job } from '@/lib/api';
import {
  formatRelativeTime,
  getPlatformDisplayName,
  getStatusColor,
} from '@/lib/utils';
import { useJobsStore } from '@/stores/jobs.store';
import { DownloadIcon, XIcon } from 'lucide-react';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const { cancelJob, isLoading } = useJobsStore();

  const handleCancel = async () => {
    if (confirm('Are you sure you want to cancel this export?')) {
      await cancelJob(job.id);
    }
  };

  const isRunning = job.status === 'running' || job.status === 'pending';
  const isCompleted = job.status === 'completed';

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
        <span
          className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
            job.status
          )}`}
        >
          {job.status}
        </span>
      </div>

      {isRunning && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>{job.progress}%</span>
          </div>
          <Progress value={job.progress} />
          <p className="text-xs text-muted-foreground mt-1">
            {job.recordsProcessed} / {job.recordsTotal || '?'} records
          </p>
        </div>
      )}

      {job.errorMessage && (
        <p className="text-sm text-destructive mb-3">{job.errorMessage}</p>
      )}

      <div className="flex gap-2">
        {isCompleted && (
          <Link href={`/api/exports/${job.id}/file`} className="flex-1">
            <Button className="w-full" size="sm">
              <DownloadIcon className="w-4 h-4 mr-2" />
              Download
            </Button>
          </Link>
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
      </div>
    </div>
  );
}
