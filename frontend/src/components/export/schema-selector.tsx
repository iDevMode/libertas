'use client';

import { DatabaseSchema } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Database, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface SchemaSelectorProps {
  databases: DatabaseSchema[];
  selectedDatabases: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function SchemaSelector({
  databases,
  selectedDatabases,
  onSelectionChange,
}: SchemaSelectorProps) {
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set());

  const toggleDatabase = (id: string) => {
    if (selectedDatabases.includes(id)) {
      onSelectionChange(selectedDatabases.filter((dbId) => dbId !== id));
    } else {
      onSelectionChange([...selectedDatabases, id]);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedDatabases);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedDatabases(newExpanded);
  };

  const selectAll = () => {
    onSelectionChange(databases.map((db) => db.id));
  };

  const selectNone = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-x-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-sm text-primary hover:underline"
          >
            Select All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={selectNone}
            className="text-sm text-primary hover:underline"
          >
            Select None
          </button>
        </div>
        <span className="text-sm text-muted-foreground">
          {selectedDatabases.length} of {databases.length} selected
        </span>
      </div>

      <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
        {databases.map((db) => (
          <div key={db.id} className="bg-white">
            <div
              className={cn(
                'flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                selectedDatabases.includes(db.id) && 'bg-primary/5'
              )}
            >
              <input
                type="checkbox"
                checked={selectedDatabases.includes(db.id)}
                onChange={() => toggleDatabase(db.id)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => toggleExpanded(db.id)}
                className="p-0.5 hover:bg-muted rounded"
              >
                {expandedDatabases.has(db.id) ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <Database className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium truncate block">{db.title}</span>
              </div>
              {db.estimatedRecords !== undefined && (
                <span className="text-sm text-muted-foreground">
                  ~{db.estimatedRecords.toLocaleString()} records
                </span>
              )}
            </div>
            {expandedDatabases.has(db.id) && db.properties.length > 0 && (
              <div className="pl-14 pr-3 pb-3">
                <div className="text-xs text-muted-foreground mb-2">
                  {db.properties.length} properties
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {db.properties.map((prop) => (
                    <span
                      key={prop.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                    >
                      <span className="text-muted-foreground">{prop.type}</span>
                      <span className="font-medium">{prop.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
