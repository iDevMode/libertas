'use client';

import { useEffect, useState } from 'react';
import { api, CsvFileInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface CsvViewerProps {
  jobId: string;
}

export function CsvViewer({ jobId }: CsvViewerProps) {
  const [files, setFiles] = useState<CsvFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const result = await api.getCsvFiles(jobId);
        setFiles(result.items);
        if (result.items.length > 0) {
          setSelectedFile(result.items[0].filename);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoadingFiles(false);
      }
    };
    loadFiles();
  }, [jobId]);

  useEffect(() => {
    if (!selectedFile) return;
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const result = await api.getCsvFileData(jobId, selectedFile, { limit, offset });
        setHeaders(result.headers);
        setRows(result.rows);
        setTotal(result.total);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, [jobId, selectedFile, offset]);

  if (isLoadingFiles) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading CSV files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No CSV files found in this export.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b mb-4 overflow-x-auto">
        {files.map((file) => (
          <button
            key={file.filename}
            onClick={() => {
              setSelectedFile(file.filename);
              setOffset(0);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
              selectedFile === file.filename
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {file.filename}
            <span className="ml-2 text-xs text-muted-foreground">
              ({file.rowCount.toLocaleString()} rows)
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoadingData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading data...</span>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {headers.map((header, i) => (
                    <th key={i} className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-muted/30">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-2 text-sm max-w-xs truncate">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {total > 0 ? offset + 1 : 0}-{Math.min(offset + limit, total)} of{' '}
              {total.toLocaleString()} rows
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
                disabled={offset + limit >= total}
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
