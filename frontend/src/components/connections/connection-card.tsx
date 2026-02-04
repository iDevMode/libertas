'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Connection } from '@/lib/api';
import { formatRelativeTime, getPlatformDisplayName, getStatusColor } from '@/lib/utils';
import { useConnectionsStore } from '@/stores/connections.store';

interface ConnectionCardProps {
  connection: Connection;
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const { disconnectPlatform, isLoading } = useConnectionsStore();

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect this platform?')) {
      await disconnectPlatform(connection.id);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">
            {getPlatformDisplayName(connection.platform)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {connection.platformAccountName}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
            connection.status
          )}`}
        >
          {connection.status}
        </span>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        <p>Connected {formatRelativeTime(connection.connectedAt)}</p>
        {connection.lastSyncedAt && (
          <p>Last synced {formatRelativeTime(connection.lastSyncedAt)}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Link href={`/export/${connection.id}`}>
          <Button size="sm">
            Export
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={isLoading}
        >
          Disconnect
        </Button>
      </div>
    </div>
  );
}
