'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { api, TierInfo } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Check, X, Crown, Zap, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatLimit(value: number): string {
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
}

const tierIcons: Record<string, React.ReactNode> = {
  community: <Zap className="w-6 h-6" />,
  pro: <Crown className="w-6 h-6" />,
  enterprise: <Building2 className="w-6 h-6" />,
};

const tierColors: Record<string, string> = {
  community: 'border-border',
  pro: 'border-primary ring-2 ring-primary/20',
  enterprise: 'border-border',
};

const tierBadgeColors: Record<string, string> = {
  community: 'bg-muted text-muted-foreground',
  pro: 'bg-primary text-primary-foreground',
  enterprise: 'bg-foreground text-background',
};

export default function PricingPage() {
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    api.getTiers()
      .then((data) => setTiers(data.tiers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading pricing...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/" className="text-2xl font-bold mb-8 inline-block">
            Libertas
          </Link>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and scale as your data liberation needs grow.
            No hidden fees. Cancel anytime.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {tiers.map((tier) => {
            const isCurrentTier = user?.tier === tier.name;
            const isPro = tier.name === 'pro';

            return (
              <div
                key={tier.name}
                className={cn(
                  'relative flex flex-col p-6 bg-card rounded-xl border-2 transition-shadow hover:shadow-lg',
                  tierColors[tier.name]
                )}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Tier header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('p-2 rounded-lg', tierBadgeColors[tier.name])}>
                      {tierIcons[tier.name]}
                    </span>
                    <h2 className="text-xl font-bold">{tier.displayName}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      {tier.price === 0 ? 'Free' : `$${tier.price}`}
                    </span>
                    {tier.price > 0 && (
                      <span className="text-muted-foreground">/month</span>
                    )}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="mb-6">
                  {isCurrentTier ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : user ? (
                    <Button
                      variant={isPro ? 'default' : 'outline'}
                      className="w-full"
                    >
                      {tier.price === 0 ? 'Downgrade' : 'Upgrade'}
                    </Button>
                  ) : (
                    <Link href="/register" className="w-full">
                      <Button
                        variant={isPro ? 'default' : 'outline'}
                        className="w-full"
                      >
                        Get Started
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Features list */}
                <ul className="space-y-3 flex-1">
                  {tier.highlights.map((highlight, i) => {
                    const isHeader = highlight.endsWith(':');
                    return (
                      <li key={i} className={cn('flex items-start gap-2 text-sm', isHeader && 'font-medium mt-2')}>
                        {!isHeader && <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />}
                        <span>{highlight}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Detailed comparison
          </h2>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Feature</th>
                  {tiers.map((tier) => (
                    <th key={tier.name} className="text-center p-4 font-medium">
                      {tier.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <ComparisonRow
                  label="Price"
                  values={tiers.map((t) => t.price === 0 ? 'Free' : `$${t.price}/mo`)}
                />
                <ComparisonRow
                  label="Records per export"
                  values={tiers.map((t) => formatLimit(t.limits.recordsPerExport))}
                />
                <ComparisonRow
                  label="Exports per month"
                  values={tiers.map((t) => formatLimit(t.limits.exportsPerMonth))}
                />
                <ComparisonRow
                  label="Connected accounts per platform"
                  values={tiers.map((t) => formatLimit(t.limits.connectedAccountsPerPlatform))}
                />
                <ComparisonRow
                  label="Concurrent jobs"
                  values={tiers.map((t) => String(t.limits.concurrentJobs))}
                />
                <ComparisonRow
                  label="Export history"
                  values={tiers.map((t) => `${t.limits.exportHistoryDays} days`)}
                />
                <ComparisonRow
                  label="SQLite export"
                  values={tiers.map(() => true)}
                  isBoolean
                />
                <ComparisonRow
                  label="JSON / CSV / Markdown export"
                  values={tiers.map(() => true)}
                  isBoolean
                />
                <ComparisonRow
                  label="Relational SQLite export"
                  values={tiers.map((t) => t.limits.allowedDestinations.includes('relational_sqlite'))}
                  isBoolean
                />
                <ComparisonRow
                  label="Cell editing"
                  values={tiers.map((t) => t.limits.allowCellEditing)}
                  isBoolean
                />
                <ComparisonRow
                  label="File attachments"
                  values={tiers.map((t) => t.limits.includeAttachments)}
                  isBoolean
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            Questions about which plan is right for you?
          </p>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

function ComparisonRow({
  label,
  values,
  isBoolean = false,
}: {
  label: string;
  values: (string | boolean)[];
  isBoolean?: boolean;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="p-4 text-sm">{label}</td>
      {values.map((value, i) => (
        <td key={i} className="p-4 text-center text-sm">
          {isBoolean ? (
            value ? (
              <Check className="w-4 h-4 text-green-500 mx-auto" />
            ) : (
              <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
            )
          ) : (
            <span className="font-medium">{value as string}</span>
          )}
        </td>
      ))}
    </tr>
  );
}
