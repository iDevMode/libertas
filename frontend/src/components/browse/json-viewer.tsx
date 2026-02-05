'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';

interface JsonViewerProps {
  jobId: string;
}

export function JsonViewer({ jobId }: JsonViewerProps) {
  const [data, setData] = useState<unknown>(null);
  const [size, setSize] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await api.getJsonExport(jobId);
        setData(result.data);
        setSize(result.size);
        setTruncated(result.truncated || false);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [jobId]);

  const handleExpandAll = useCallback(() => setExpandAll(true), []);
  const handleCollapseAll = useCallback(() => setExpandAll(false), []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading JSON data...</span>
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

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" size="sm" onClick={handleExpandAll}>
          Expand All
        </Button>
        <Button variant="outline" size="sm" onClick={handleCollapseAll}>
          Collapse All
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {formatSize(size)}
        </span>
      </div>

      {truncated && (
        <div className="flex items-center gap-2 mb-4 border border-yellow-200 rounded-lg p-3 bg-yellow-50">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            This file exceeds 10MB. Showing truncated data.
          </p>
        </div>
      )}

      {/* JSON Tree */}
      <div className="border rounded-lg p-4 bg-muted/20 font-mono text-sm overflow-x-auto max-h-[600px] overflow-y-auto">
        <JsonNode value={data} expandAll={expandAll} depth={0} />
      </div>
    </div>
  );
}

interface JsonNodeProps {
  value: unknown;
  expandAll: boolean;
  depth: number;
  keyName?: string;
}

function JsonNode({ value, expandAll, depth, keyName }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  useEffect(() => {
    if (expandAll) {
      setIsExpanded(true);
    } else if (depth >= 2) {
      setIsExpanded(false);
    }
  }, [expandAll, depth]);

  const indent = depth * 16;

  if (value === null) {
    return (
      <span>
        {keyName !== undefined && <span className="text-foreground">{`"${keyName}": `}</span>}
        <span className="text-gray-400">null</span>
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span>
        {keyName !== undefined && <span className="text-foreground">{`"${keyName}": `}</span>}
        <span className="text-orange-500">{String(value)}</span>
      </span>
    );
  }

  if (typeof value === 'number') {
    return (
      <span>
        {keyName !== undefined && <span className="text-foreground">{`"${keyName}": `}</span>}
        <span className="text-blue-500">{value}</span>
      </span>
    );
  }

  if (typeof value === 'string') {
    const display = value.length > 200 ? value.substring(0, 200) + '...' : value;
    return (
      <span>
        {keyName !== undefined && <span className="text-foreground">{`"${keyName}": `}</span>}
        <span className="text-green-600">{`"${display}"`}</span>
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span>
          {keyName !== undefined && <span className="text-foreground">{`"${keyName}": `}</span>}
          <span className="text-muted-foreground">{'[]'}</span>
        </span>
      );
    }

    return (
      <div>
        <span
          className="cursor-pointer inline-flex items-center hover:bg-muted/50 rounded"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 inline" />
          ) : (
            <ChevronRight className="w-3 h-3 inline" />
          )}
          {keyName !== undefined && <span className="text-foreground">{`"${keyName}": `}</span>}
          <span className="text-muted-foreground">
            {'['}
            {!isExpanded && (
              <span className="text-xs ml-1 text-muted-foreground bg-muted px-1 rounded">
                {value.length} items
              </span>
            )}
            {!isExpanded && ']'}
          </span>
        </span>
        {isExpanded && (
          <div style={{ marginLeft: indent + 16 }}>
            {value.map((item, i) => (
              <div key={i}>
                <JsonNode value={item} expandAll={expandAll} depth={depth + 1} />
                {i < value.length - 1 && <span className="text-muted-foreground">,</span>}
              </div>
            ))}
            <div style={{ marginLeft: -16 }}>
              <span className="text-muted-foreground">{']'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <span>
          {keyName !== undefined && <span className="text-foreground">{`"${keyName}": `}</span>}
          <span className="text-muted-foreground">{'{}'}</span>
        </span>
      );
    }

    return (
      <div>
        <span
          className="cursor-pointer inline-flex items-center hover:bg-muted/50 rounded"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 inline" />
          ) : (
            <ChevronRight className="w-3 h-3 inline" />
          )}
          {keyName !== undefined && <span className="text-foreground">{`"${keyName}": `}</span>}
          <span className="text-muted-foreground">
            {'{'}
            {!isExpanded && (
              <span className="text-xs ml-1 text-muted-foreground bg-muted px-1 rounded">
                {entries.length} keys
              </span>
            )}
            {!isExpanded && '}'}
          </span>
        </span>
        {isExpanded && (
          <div style={{ marginLeft: indent + 16 }}>
            {entries.map(([key, val], i) => (
              <div key={key}>
                <JsonNode value={val} expandAll={expandAll} depth={depth + 1} keyName={key} />
                {i < entries.length - 1 && <span className="text-muted-foreground">,</span>}
              </div>
            ))}
            <div style={{ marginLeft: -16 }}>
              <span className="text-muted-foreground">{'}'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <span className="text-foreground">{String(value)}</span>;
}
