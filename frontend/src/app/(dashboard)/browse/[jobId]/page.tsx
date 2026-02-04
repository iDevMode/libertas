'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useJobsStore } from '@/stores/jobs.store';
import { api, Entity, Job } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  formatRelativeTime,
  getPlatformDisplayName,
  getStatusColor,
} from '@/lib/utils';
import { ArrowLeft, Search, Loader2, RefreshCw, ExternalLink } from 'lucide-react';

export default function BrowseDataPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const { isAuthenticated, checkAuth } = useAuthStore();
  const { fetchJob, currentJob } = useJobsStore();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [totalEntities, setTotalEntities] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

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

  useEffect(() => {
    const loadEntities = async () => {
      if (!currentJob || currentJob.status !== 'completed') return;

      setIsLoading(true);
      setError(null);

      try {
        const params: { type?: string; search?: string; limit: number; offset: number } = {
          limit,
          offset,
        };
        if (searchQuery) params.search = searchQuery;
        if (typeFilter) params.type = typeFilter;

        const result = await api.getExportEntities(jobId, params);
        setEntities(result.items);
        setTotalEntities(result.total);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntities();
  }, [jobId, currentJob, searchQuery, typeFilter, offset]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
  };

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

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setOffset(0);
          }}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">All Types</option>
          <option value="page">Pages</option>
          <option value="database">Databases</option>
          <option value="record">Records</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 border border-red-200 rounded-lg p-4 bg-red-50">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Entities Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading entities...</span>
        </div>
      ) : entities.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery || typeFilter
              ? 'No entities match your search criteria.'
              : 'No entities found in this export.'}
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Updated</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entities.map((entity) => (
                  <tr key={entity.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/browse/${jobId}/entity/${entity.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {entity.title || 'Untitled'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground capitalize">
                        {entity.entity_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(entity.updated_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/browse/${jobId}/entity/${entity.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          View Data
                        </Link>
                        {entity.source_url && (
                          <a
                            href={entity.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                          >
                            Source
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1}-{Math.min(offset + limit, totalEntities)} of{' '}
              {totalEntities.toLocaleString()} entities
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= totalEntities}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
