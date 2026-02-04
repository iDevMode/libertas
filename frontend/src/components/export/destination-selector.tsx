'use client';

import { cn } from '@/lib/utils';
import { Database, FileJson, FileSpreadsheet, FileText, Check, Crown, Link2 } from 'lucide-react';

export type DestinationType = 'sqlite' | 'json' | 'csv' | 'markdown' | 'relational_sqlite';

interface DestinationOption {
  id: DestinationType;
  name: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
  pro?: boolean;
}

const destinations: DestinationOption[] = [
  {
    id: 'sqlite',
    name: 'SQLite Database',
    description: 'Portable database file with full query support. Best for data analysis.',
    icon: <Database className="w-6 h-6" />,
    recommended: true,
  },
  {
    id: 'relational_sqlite',
    name: 'Relational SQLite',
    description: 'Database tables with typed columns and foreign keys. Perfect for BI tools.',
    icon: <Link2 className="w-6 h-6" />,
    pro: true,
  },
  {
    id: 'json',
    name: 'JSON Files',
    description: 'Structured data format. Great for developers and data processing.',
    icon: <FileJson className="w-6 h-6" />,
  },
  {
    id: 'csv',
    name: 'CSV Files',
    description: 'Spreadsheet-compatible format. Opens in Excel, Google Sheets, etc.',
    icon: <FileSpreadsheet className="w-6 h-6" />,
  },
  {
    id: 'markdown',
    name: 'Markdown Files',
    description: 'Human-readable text format. Ideal for documentation and notes.',
    icon: <FileText className="w-6 h-6" />,
  },
];

interface DestinationSelectorProps {
  selected: DestinationType;
  onSelect: (destination: DestinationType) => void;
  userTier?: 'community' | 'pro' | 'enterprise';
}

export function DestinationSelector({ selected, onSelect, userTier = 'community' }: DestinationSelectorProps) {
  const canAccessPro = userTier === 'pro' || userTier === 'enterprise';

  const handleSelect = (dest: DestinationOption) => {
    if (dest.pro && !canAccessPro) {
      // Show upgrade prompt or don't allow selection
      return;
    }
    onSelect(dest.id);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {destinations.map((dest) => {
        const isLocked = dest.pro && !canAccessPro;

        return (
          <button
            key={dest.id}
            type="button"
            onClick={() => handleSelect(dest)}
            disabled={isLocked}
            className={cn(
              'relative flex items-start gap-3 p-4 border rounded-lg text-left transition-colors',
              selected === dest.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : isLocked
                  ? 'opacity-60 cursor-not-allowed hover:border-border'
                  : 'hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            {selected === dest.id && (
              <div className="absolute top-2 right-2">
                <Check className="w-4 h-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                'p-2 rounded-lg shrink-0',
                selected === dest.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {dest.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{dest.name}</span>
                {dest.recommended && (
                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                    Recommended
                  </span>
                )}
                {dest.pro && (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                    <Crown className="w-3 h-3" />
                    Pro
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{dest.description}</p>
              {isLocked && (
                <p className="text-xs text-amber-600 mt-2">
                  Upgrade to Pro to unlock this feature
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
