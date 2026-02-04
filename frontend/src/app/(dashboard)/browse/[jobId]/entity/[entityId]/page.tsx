'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { api, EntityDetail, ContentBlock, Property, Attachment } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import { ArrowLeft, Loader2, ExternalLink, FileIcon, ImageIcon, VideoIcon, FileTextIcon } from 'lucide-react';

export default function EntityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;
  const entityId = params.entityId as string;

  const { isAuthenticated, checkAuth } = useAuthStore();
  const [entityDetail, setEntityDetail] = useState<EntityDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        router.push('/login');
        return;
      }
      loadEntityDetail();
    };
    init();
  }, [checkAuth, router]);

  const loadEntityDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const detail = await api.getExportEntity(jobId, entityId);
      setEntityDetail(detail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !entityDetail) {
    return (
      <div className="container py-8">
        <Link
          href={`/browse/${jobId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Export Data
        </Link>
        <div className="border border-red-200 rounded-lg p-8 bg-red-50 text-center">
          <p className="text-red-800">{error || 'Entity not found'}</p>
        </div>
      </div>
    );
  }

  const { entity, properties, contentBlocks, attachments, relations } = entityDetail;

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/browse/${jobId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Export Data
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold truncate">{entity.title || 'Untitled'}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="capitalize px-2 py-0.5 bg-muted rounded">{entity.entity_type}</span>
              <span>Updated {formatRelativeTime(entity.updated_at)}</span>
            </div>
          </div>
          {entity.source_url && (
            <a
              href={entity.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Source
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Properties Section */}
      {properties.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Properties</h2>
          <div className="border rounded-lg divide-y">
            {properties.map((prop) => (
              <PropertyRow key={prop.id} property={prop} />
            ))}
          </div>
        </section>
      )}

      {/* Content Blocks Section */}
      {contentBlocks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Content</h2>
          <div className="border rounded-lg p-6 prose prose-sm max-w-none dark:prose-invert">
            {contentBlocks.map((block) => (
              <ContentBlockRenderer key={block.id} block={block} />
            ))}
          </div>
        </section>
      )}

      {/* Attachments Section */}
      {attachments.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Attachments ({attachments.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attachments.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} />
            ))}
          </div>
        </section>
      )}

      {/* Relations Section */}
      {relations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Relations ({relations.length})</h2>
          <div className="border rounded-lg divide-y">
            {relations.map((relation) => (
              <div key={relation.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">{relation.relation_type}</span>
                  <p className="font-mono text-sm">
                    {relation.from_entity_id === entityId
                      ? relation.to_entity_id
                      : relation.from_entity_id}
                  </p>
                </div>
                <Link
                  href={`/browse/${jobId}/entity/${
                    relation.from_entity_id === entityId
                      ? relation.to_entity_id
                      : relation.from_entity_id
                  }`}
                >
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Raw Metadata */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Metadata</h2>
        <div className="border rounded-lg p-4 bg-muted/30">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono truncate">{entity.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="capitalize">{entity.entity_type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Platform</dt>
              <dd className="capitalize">{entity.source_platform}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatRelativeTime(entity.created_at)}</dd>
            </div>
            {entity.parent_id && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Parent ID</dt>
                <dd className="font-mono truncate">
                  <Link
                    href={`/browse/${jobId}/entity/${entity.parent_id}`}
                    className="text-primary hover:underline"
                  >
                    {entity.parent_id}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>
    </div>
  );
}

function PropertyRow({ property }: { property: Property }) {
  const getValue = () => {
    if (property.value_text !== null) return property.value_text;
    if (property.value_number !== null) return property.value_number.toString();
    if (property.value_boolean !== null) return property.value_boolean ? 'Yes' : 'No';
    if (property.value_date !== null) return new Date(property.value_date).toLocaleDateString();
    if (property.value_json !== null) {
      return (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
          {JSON.stringify(property.value_json, null, 2)}
        </pre>
      );
    }
    return <span className="text-muted-foreground italic">Empty</span>;
  };

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-2">
      <div className="sm:w-1/3">
        <span className="font-medium">{property.property_name}</span>
        <span className="ml-2 text-xs text-muted-foreground">({property.property_type})</span>
      </div>
      <div className="sm:w-2/3 break-words">{getValue()}</div>
    </div>
  );
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  const content = block.content || '';

  switch (block.block_type) {
    case 'heading_1':
      return <h1 className="text-2xl font-bold mt-6 mb-3">{content}</h1>;
    case 'heading_2':
      return <h2 className="text-xl font-bold mt-5 mb-2">{content}</h2>;
    case 'heading_3':
      return <h3 className="text-lg font-bold mt-4 mb-2">{content}</h3>;
    case 'paragraph':
      return <p className="my-2">{content}</p>;
    case 'bulleted_list_item':
      return <li className="ml-4 list-disc">{content}</li>;
    case 'numbered_list_item':
      return <li className="ml-4 list-decimal">{content}</li>;
    case 'to_do':
      return (
        <div className="flex items-start gap-2 my-1">
          <input type="checkbox" disabled className="mt-1" />
          <span>{content}</span>
        </div>
      );
    case 'toggle':
      return (
        <details className="my-2">
          <summary className="cursor-pointer font-medium">{content}</summary>
        </details>
      );
    case 'code':
      return (
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
          <code className="text-sm">{content}</code>
        </pre>
      );
    case 'quote':
      return (
        <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-4">
          {content}
        </blockquote>
      );
    case 'callout':
      return (
        <div className="bg-muted/50 border rounded-lg p-4 my-4">
          {content}
        </div>
      );
    case 'divider':
      return <hr className="my-6" />;
    case 'image':
      return (
        <figure className="my-4">
          <img src={content} alt="" className="rounded-lg max-w-full" />
        </figure>
      );
    case 'video':
      return (
        <div className="my-4">
          <video src={content} controls className="rounded-lg max-w-full" />
        </div>
      );
    case 'embed':
      return (
        <div className="my-4 p-4 border rounded-lg bg-muted/30">
          <a href={content} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {content}
          </a>
        </div>
      );
    case 'table':
      return (
        <div className="my-4 overflow-x-auto">
          <pre className="text-xs">{content}</pre>
        </div>
      );
    default:
      return <p className="my-2">{content}</p>;
  }
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const getIcon = () => {
    const type = attachment.file_type?.toLowerCase() || '';
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (type.startsWith('video/')) return <VideoIcon className="w-5 h-5" />;
    if (type.includes('pdf') || type.includes('document')) return <FileTextIcon className="w-5 h-5" />;
    return <FileIcon className="w-5 h-5" />;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border rounded-lg p-4 flex items-center gap-3">
      <div className="text-muted-foreground">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{attachment.file_name}</p>
        <p className="text-sm text-muted-foreground">
          {attachment.file_type} {attachment.file_size && `· ${formatSize(attachment.file_size)}`}
        </p>
      </div>
      {attachment.source_url && (
        <a
          href={attachment.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
        >
          Open
        </a>
      )}
    </div>
  );
}
