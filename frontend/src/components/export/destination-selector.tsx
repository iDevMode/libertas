'use client';

import { cn } from '@/lib/utils';
import { Database, FileJson, FileSpreadsheet, FileText, Check } from 'lucide-react';

export type DestinationType = 'sqlite' | 'json' | 'csv' | 'markdown';

interface DestinationOption {
  id: DestinationType;
  name: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
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
}

export function DestinationSelector({ selected, onSelect }: DestinationSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {destinations.map((dest) => (
        <button
          key={dest.id}
          type="button"
          onClick={() => onSelect(dest.id)}
          className={cn(
            'relative flex items-start gap-3 p-4 border rounded-lg text-left transition-colors',
            selected === dest.id
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
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
            <div className="flex items-center gap-2">
              <span className="font-medium">{dest.name}</span>
              {dest.recommended && (
                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{dest.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
