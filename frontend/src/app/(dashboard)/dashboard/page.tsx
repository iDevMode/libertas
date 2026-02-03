'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectionsStore } from '@/stores/connections.store';
import { useJobsStore } from '@/stores/jobs.store';
import { Button } from '@/components/ui/button';
import { ConnectionCard } from '@/components/connections/connection-card';
import { JobCard } from '@/components/jobs/job-card';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, checkAuth } = useAuthStore();
  const { connections, fetchConnections, isLoading: connectionsLoading } = useConnectionsStore();
  const { jobs, fetchJobs, isLoading: jobsLoading } = useJobsStore();

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        router.push('/login');
        return;
      }
      fetchConnections();
      fetchJobs();
    };
    init();
  }, [checkAuth, router, fetchConnections, fetchJobs]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.email}
        </p>
      </div>

      {/* Connected Platforms */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Connected Platforms</h2>
          <Link href="/connections/new">
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Connect Platform
            </Button>
          </Link>
        </div>

        {connectionsLoading ? (
          <p className="text-muted-foreground">Loading connections...</p>
        ) : connections.length === 0 ? (
          <div className="border rounded-lg p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No platforms connected yet. Connect your first platform to start
              exporting data.
            </p>
            <Link href="/connections/new">
              <Button>Connect Platform</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.map((connection) => (
              <ConnectionCard key={connection.id} connection={connection} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Exports */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Exports</h2>
          <Link href="/jobs">
            <Button variant="outline">View All</Button>
          </Link>
        </div>

        {jobsLoading ? (
          <p className="text-muted-foreground">Loading exports...</p>
        ) : jobs.length === 0 ? (
          <div className="border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              No exports yet. Connect a platform and start your first export.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.slice(0, 5).map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
