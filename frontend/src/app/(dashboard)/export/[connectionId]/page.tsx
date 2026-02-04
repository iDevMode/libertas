'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectionsStore } from '@/stores/connections.store';
import { useJobsStore } from '@/stores/jobs.store';
import { Connection, SourceSchema } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SchemaSelector } from '@/components/export/schema-selector';
import { DestinationSelector, DestinationType } from '@/components/export/destination-selector';
import { getPlatformDisplayName } from '@/lib/utils';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ExportConfigPage() {
  const router = useRouter();
  const params = useParams();
  const connectionId = params.connectionId as string;

  const { isAuthenticated, checkAuth, user } = useAuthStore();
  const { connections, fetchConnections, getSchema } = useConnectionsStore();
  const { createJob, isLoading: isCreatingJob, error: jobError, clearError } = useJobsStore();

  const [connection, setConnection] = useState<Connection | null>(null);
  const [schema, setSchema] = useState<SourceSchema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Form state
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);
  const [destinationType, setDestinationType] = useState<DestinationType>('sqlite');
  const [includeAttachments, setIncludeAttachments] = useState(false);

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        router.push('/login');
        return;
      }

      // Fetch connections if not loaded
      if (connections.length === 0) {
        await fetchConnections();
      }
    };
    init();
  }, [checkAuth, router, fetchConnections, connections.length]);

  useEffect(() => {
    // Find the connection
    const conn = connections.find((c) => c.id === connectionId);
    if (conn) {
      setConnection(conn);
    } else if (connections.length > 0) {
      // Connection not found after loading
      router.push('/dashboard');
    }
  }, [connections, connectionId, router]);

  useEffect(() => {
    // Fetch schema when connection is found
    const loadSchema = async () => {
      if (!connection) return;

      setIsLoadingSchema(true);
      setSchemaError(null);

      try {
        const schemaData = await getSchema(connection.id);
        if (schemaData) {
          setSchema(schemaData);
          // Select all databases by default
          setSelectedDatabases(schemaData.databases.map((db) => db.id));
        } else {
          setSchemaError('Failed to load schema. Please try again.');
        }
      } catch (err) {
        setSchemaError((err as Error).message);
      } finally {
        setIsLoadingSchema(false);
      }
    };

    loadSchema();
  }, [connection, getSchema]);

  const handleStartExport = async () => {
    if (!connection || selectedDatabases.length === 0) return;

    clearError();

    const job = await createJob({
      connectionId: connection.id,
      selectedEntities: selectedDatabases,
      destinationType,
      includeAttachments,
    });

    if (job) {
      router.push('/dashboard');
    }
  };

  if (!isAuthenticated || !connection) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Configure Export</h1>
        <p className="text-muted-foreground mt-1">
          Export data from {getPlatformDisplayName(connection.platform)}
        </p>
      </div>

      {/* Connection Info */}
      <div className="border rounded-lg p-4 mb-8 bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{getPlatformDisplayName(connection.platform)}</p>
            <p className="text-sm text-muted-foreground">{connection.platformAccountName}</p>
          </div>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Connected</span>
          </div>
        </div>
      </div>

      {/* Schema Selection */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Select Data to Export</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which databases and tables to include in the export.
        </p>

        {isLoadingSchema ? (
          <div className="border rounded-lg p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Loading schema...</span>
          </div>
        ) : schemaError ? (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Failed to load schema</p>
                <p className="text-sm text-red-600 mt-1">{schemaError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSchemaError(null);
                    setIsLoadingSchema(true);
                    getSchema(connection.id).then((data) => {
                      if (data) {
                        setSchema(data);
                        setSelectedDatabases(data.databases.map((db) => db.id));
                      } else {
                        setSchemaError('Failed to load schema. Please try again.');
                      }
                      setIsLoadingSchema(false);
                    });
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        ) : schema && schema.databases.length > 0 ? (
          <SchemaSelector
            databases={schema.databases}
            selectedDatabases={selectedDatabases}
            onSelectionChange={setSelectedDatabases}
          />
        ) : (
          <div className="border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              No databases or tables found in this account.
            </p>
          </div>
        )}
      </section>

      {/* Destination Selection */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Choose Export Format</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Select the format for your exported data.
        </p>
        <DestinationSelector
          selected={destinationType}
          onSelect={setDestinationType}
          userTier={user?.tier}
        />
      </section>

      {/* Options */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Export Options</h2>
        <div className="border rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAttachments}
              onChange={(e) => setIncludeAttachments(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <span className="font-medium">Include attachments</span>
              <p className="text-sm text-muted-foreground">
                Download and include file attachments in the export. This may significantly increase export size and time.
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Error Message */}
      {jobError && (
        <div className="mb-6 border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Export failed to start</p>
              <p className="text-sm text-red-600 mt-1">{jobError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary & Action */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedDatabases.length > 0 ? (
              <span>
                Exporting <strong>{selectedDatabases.length}</strong> database
                {selectedDatabases.length !== 1 ? 's' : ''} to{' '}
                <strong>{destinationType.toUpperCase()}</strong>
              </span>
            ) : (
              <span>Select at least one database to export</span>
            )}
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleStartExport}
              disabled={selectedDatabases.length === 0 || isCreatingJob || isLoadingSchema}
            >
              {isCreatingJob ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Export...
                </>
              ) : (
                'Start Export'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
