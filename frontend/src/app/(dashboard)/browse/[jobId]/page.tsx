'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useJobsStore } from '@/stores/jobs.store';
import { Button } from '@/components/ui/button';
import {
  formatRelativeTime,
  getPlatformDisplayName,
  getStatusColor,
} from '@/lib/utils';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { SqliteEntityBrowser } from '@/components/browse/sqlite-entity-browser';
import { MarkdownViewer } from '@/components/browse/markdown-viewer';
import { JsonViewer } from '@/components/browse/json-viewer';
import { CsvViewer } from '@/components/browse/csv-viewer';
import { RelationalTableBrowser } from '@/components/browse/relational-table-browser';

export default function BrowseDataPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const { isAuthenticated, checkAuth } = useAuthStore();
  const { fetchJob, currentJob } = useJobsStore();

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        router.push('/login');
        return;
      }
      fetchJob(jobId);
    };
    init();
  }, [checkAuth, router, fetchJob, jobId]);

  if (!isAuthenticated) {
    return null;
  }

  if (!currentJob) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (currentJob.status !== 'completed') {
    return (
      <div className="container py-8">
        <Link
          href="/jobs"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Exports
        </Link>
        <div className="border rounded-lg p-8 text-center">
          <p className="text-lg font-medium mb-2">Export Not Ready</p>
          <p className="text-muted-foreground mb-4">
            This export is currently{' '}
            <span className={`px-2 py-0.5 rounded-full text-sm ${getStatusColor(currentJob.status)}`}>
              {currentJob.status}
            </span>
          </p>
          <Link href="/jobs">
            <Button>View All Exports</Button>
          </Link>
        </div>
      </div>
    );
  }

  const renderViewer = () => {
    switch (currentJob.destinationType) {
      case 'sqlite':
        return <SqliteEntityBrowser jobId={jobId} />;
      case 'markdown':
        return <MarkdownViewer jobId={jobId} />;
      case 'json':
        return <JsonViewer jobId={jobId} />;
      case 'csv':
        return <CsvViewer jobId={jobId} />;
      case 'relational_sqlite':
        return <RelationalTableBrowser jobId={jobId} />;
      default:
        return (
          <div className="border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              Browsing is not supported for {currentJob.destinationType} exports.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/jobs"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Exports
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Browse Export Data</h1>
            <p className="text-muted-foreground mt-1">
              {getPlatformDisplayName(currentJob.sourcePlatform)} export from{' '}
              {formatRelativeTime(currentJob.createdAt)}
            </p>
          </div>
          <Link href={`/api/exports/${jobId}/file`}>
            <Button>
              Download {currentJob.destinationType.toUpperCase()}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Records</p>
          <p className="text-2xl font-bold">{currentJob.recordsTotal?.toLocaleString() || 0}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Format</p>
          <p className="text-2xl font-bold uppercase">{currentJob.destinationType}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(currentJob.status)}`}>
            {currentJob.status}
          </span>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-lg font-medium">
            {currentJob.completedAt ? formatRelativeTime(currentJob.completedAt) : '-'}
          </p>
        </div>
      </div>

      {/* Format-specific viewer */}
      {renderViewer()}
    </div>
  );
}
