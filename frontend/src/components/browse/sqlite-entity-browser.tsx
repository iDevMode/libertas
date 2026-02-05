'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Entity } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelativeTime } from '@/lib/utils';
import { Search, Loader2, ExternalLink } from 'lucide-react';

interface SqliteEntityBrowserProps {
  jobId: string;
}

export function SqliteEntityBrowser({ jobId }: SqliteEntityBrowserProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [totalEntities, setTotalEntities] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    const loadEntities = async () => {
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
  }, [jobId, searchQuery, typeFilter, offset]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
  };

  return (
    <>
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
    </>
  );
}
