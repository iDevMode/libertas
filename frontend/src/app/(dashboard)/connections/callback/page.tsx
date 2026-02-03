'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConnectionsStore } from '@/stores/connections.store';
import { getPlatformDisplayName } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export default function ConnectionCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connectPlatform, clearConnecting } = useConnectionsStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const platform = searchParams.get('platform');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  useEffect(() => {
    const handleCallback = async () => {
      if (!platform || !code) {
        setStatus('error');
        setErrorMessage('Missing required parameters');
        setTimeout(() => {
          router.push('/connections?error=Missing+required+parameters');
        }, 2000);
        return;
      }

      try {
        const success = await connectPlatform(platform, code, state || undefined);
        clearConnecting();

        if (success) {
          setStatus('success');
          setTimeout(() => {
            router.push(`/connections?success=${encodeURIComponent(getPlatformDisplayName(platform))}`);
          }, 1500);
        } else {
          setStatus('error');
          setErrorMessage('Failed to connect platform');
          setTimeout(() => {
            router.push('/connections?error=Failed+to+connect+platform');
          }, 2000);
        }
      } catch (err) {
        clearConnecting();
        setStatus('error');
        setErrorMessage((err as Error).message);
        setTimeout(() => {
          router.push(`/connections?error=${encodeURIComponent((err as Error).message)}`);
        }, 2000);
      }
    };

    handleCallback();
  }, [platform, code, state, connectPlatform, clearConnecting, router]);

  return (
    <div className="container py-16">
      <div className="max-w-md mx-auto text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <h1 className="text-2xl font-bold mb-2">Connecting...</h1>
            <p className="text-muted-foreground">
              Completing your {platform ? getPlatformDisplayName(platform) : 'platform'} connection.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Connected!</h1>
            <p className="text-muted-foreground">
              Successfully connected to {platform ? getPlatformDisplayName(platform) : 'platform'}.
              Redirecting...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Connection Failed</h1>
            <p className="text-muted-foreground">
              {errorMessage || 'Something went wrong'}. Redirecting...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
