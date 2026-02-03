'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectionsStore } from '@/stores/connections.store';
import { PlatformCard, PlatformInfo } from '@/components/connections/platform-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileSpreadsheet, Database, FileText } from 'lucide-react';

const platforms: PlatformInfo[] = [
  {
    id: 'notion',
    name: 'Notion',
    description: 'Export pages, databases, and all your workspace content.',
    icon: <FileText className="w-6 h-6" />,
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Export bases, tables, and records with all field types.',
    icon: <Database className="w-6 h-6" />,
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Export spreadsheets with all sheets and formatting.',
    icon: <FileSpreadsheet className="w-6 h-6" />,
  },
];

export default function ConnectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const {
    connections,
    fetchConnections,
    initiateOAuth,
    disconnectPlatform,
    isLoading,
    connectingPlatform,
    error,
    clearError,
  } = useConnectionsStore();

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        router.push('/login');
        return;
      }
      fetchConnections();
    };
    init();
  }, [checkAuth, router, fetchConnections]);

  useEffect(() => {
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (success) {
      fetchConnections();
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
    }

    if (errorParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, fetchConnections]);

  const getConnectionForPlatform = (platformId: string) => {
    return connections.find((c) => c.platform === platformId);
  };

  const handleConnect = (platformId: string) => {
    clearError();
    initiateOAuth(platformId);
  };

  const handleDisconnect = async (connectionId: string) => {
    if (confirm('Are you sure you want to disconnect this platform?')) {
      await disconnectPlatform(connectionId);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Connect Your Platforms</h1>
        <p className="text-muted-foreground mt-2">
          Select a platform to connect and start exporting your data. Your data
          stays yours.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="mt-2 text-red-700 hover:text-red-800"
          >
            Dismiss
          </Button>
        </div>
      )}

      {searchParams.get('success') && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            Successfully connected to {searchParams.get('success')}!
          </p>
        </div>
      )}

      {searchParams.get('error') && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            Failed to connect: {decodeURIComponent(searchParams.get('error') || '')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {platforms.map((platform) => {
          const connection = getConnectionForPlatform(platform.id);
          return (
            <PlatformCard
              key={platform.id}
              platform={platform}
              isConnected={!!connection}
              connectedAccountName={connection?.platformAccountName}
              isLoading={
                isLoading || connectingPlatform === platform.id
              }
              onConnect={() => handleConnect(platform.id)}
              onDisconnect={() => connection && handleDisconnect(connection.id)}
            />
          );
        })}
      </div>

      {connections.length > 0 && (
        <div className="mt-12 p-6 bg-muted/50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Ready to export?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You have {connections.length} platform{connections.length > 1 ? 's' : ''} connected.
            Head back to the dashboard to start exporting your data.
          </p>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
