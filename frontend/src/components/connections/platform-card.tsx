'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface PlatformInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface PlatformCardProps {
  platform: PlatformInfo;
  isConnected: boolean;
  connectedAccountName?: string;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function PlatformCard({
  platform,
  isConnected,
  connectedAccountName,
  isLoading,
  onConnect,
  onDisconnect,
}: PlatformCardProps) {
  return (
    <div
      className={cn(
        'border rounded-lg p-6 transition-colors',
        isConnected ? 'border-green-200 bg-green-50/50' : 'hover:border-primary/50'
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {platform.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg">{platform.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {platform.description}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-green-700">Connected</span>
            </div>
            {connectedAccountName && (
              <p className="text-sm text-muted-foreground truncate">
                {connectedAccountName}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
          </div>
        ) : (
          <Button
            onClick={onConnect}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
