import { SubscriptionTier, DestinationType } from './types.js';

export interface TierLimits {
  recordsPerExport: number;
  exportsPerMonth: number;
  connectedAccountsPerPlatform: number;
  concurrentJobs: number;
  includeAttachments: boolean;
  exportHistoryDays: number;
  allowedDestinations: DestinationType[];
  allowCellEditing: boolean;
}

export interface TierInfo {
  name: string;
  displayName: string;
  price: number;
  billingPeriod: 'month';
  description: string;
  limits: TierLimits;
  highlights: string[];
}

export const TIER_CONFIG: Record<SubscriptionTier, TierInfo> = {
  community: {
    name: 'community',
    displayName: 'Free',
    price: 0,
    billingPeriod: 'month',
    description: 'For individuals getting started with data liberation',
    limits: {
      recordsPerExport: 1_000,
      exportsPerMonth: 5,
      connectedAccountsPerPlatform: 1,
      concurrentJobs: 1,
      includeAttachments: false,
      exportHistoryDays: 7,
      allowedDestinations: ['sqlite', 'json', 'csv', 'markdown'],
      allowCellEditing: false,
    },
    highlights: [
      'All 3 connectors (Notion, Airtable, Google Sheets)',
      'Export to SQLite, JSON, CSV, Markdown',
      'Up to 1,000 records per export',
      '5 exports per month',
      'Community support',
    ],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    price: 29,
    billingPeriod: 'month',
    description: 'For power users who need full control over their data',
    limits: {
      recordsPerExport: 100_000,
      exportsPerMonth: -1, // unlimited
      connectedAccountsPerPlatform: 5,
      concurrentJobs: 3,
      includeAttachments: true,
      exportHistoryDays: 90,
      allowedDestinations: ['sqlite', 'json', 'csv', 'markdown', 'relational_sqlite'],
      allowCellEditing: true,
    },
    highlights: [
      'Everything in Free, plus:',
      'Relational SQLite with full cell editing',
      'Up to 100,000 records per export',
      'Unlimited exports per month',
      'File attachment exports',
      '5 connected accounts per platform',
      '3 concurrent jobs',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    price: 79,
    billingPeriod: 'month',
    description: 'For teams and organizations with large-scale data needs',
    limits: {
      recordsPerExport: -1, // unlimited
      exportsPerMonth: -1, // unlimited
      connectedAccountsPerPlatform: -1, // unlimited
      concurrentJobs: 10,
      includeAttachments: true,
      exportHistoryDays: 365,
      allowedDestinations: ['sqlite', 'json', 'csv', 'markdown', 'relational_sqlite'],
      allowCellEditing: true,
    },
    highlights: [
      'Everything in Pro, plus:',
      'Unlimited records per export',
      'Unlimited connected accounts',
      '10 concurrent jobs',
      'Priority job processing',
      '1-year export history',
      'Dedicated support',
    ],
  },
};

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_CONFIG[tier].limits;
}

export function isDestinationAllowed(tier: SubscriptionTier, destination: DestinationType): boolean {
  return TIER_CONFIG[tier].limits.allowedDestinations.includes(destination);
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function formatLimit(value: number): string {
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
}
