'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, MarkdownFileInfo } from '@/lib/api';
import { Loader2, FileText } from 'lucide-react';

interface MarkdownViewerProps {
  jobId: string;
}

export function MarkdownViewer({ jobId }: MarkdownViewerProps) {
  const [files, setFiles] = useState<MarkdownFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const result = await api.getMarkdownFiles(jobId);
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
    const loadContent = async () => {
      setIsLoadingContent(true);
      try {
        const result = await api.getMarkdownFile(jobId, selectedFile);
        setContent(result.content);
      } catch (err) {
        setContent(`Failed to load file: ${(err as Error).message}`);
      } finally {
        setIsLoadingContent(false);
      }
    };
    loadContent();
  }, [jobId, selectedFile]);

  if (isLoadingFiles) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading markdown files...</span>
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
        <p className="text-muted-foreground">No markdown files found in this export.</p>
      </div>
    );
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="flex gap-4 min-h-[500px]">
      {/* File sidebar */}
      <div className="w-64 shrink-0 border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-3 py-2 border-b">
          <p className="text-sm font-medium">{files.length} files</p>
        </div>
        <div className="overflow-y-auto max-h-[600px]">
          {files.map((file) => (
            <button
              key={file.filename}
              onClick={() => setSelectedFile(file.filename)}
              className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted/30 flex items-start gap-2 ${
                selectedFile === file.filename ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              <FileText className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-medium">{file.filename}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 border-b">
          <p className="text-sm font-medium">{selectedFile}</p>
        </div>
        <div className="p-6 overflow-y-auto max-h-[600px]">
          {isLoadingContent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
