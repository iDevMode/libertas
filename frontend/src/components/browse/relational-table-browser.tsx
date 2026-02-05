'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, RelationalTableInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, Check, X } from 'lucide-react';

interface RelationalTableBrowserProps {
  jobId: string;
}

export function RelationalTableBrowser({ jobId }: RelationalTableBrowserProps) {
  const [tables, setTables] = useState<RelationalTableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const limit = 50;

  // Load tables
  useEffect(() => {
    const loadTables = async () => {
      try {
        const result = await api.getRelationalTables(jobId);
        setTables(result.tables);
        if (result.tables.length > 0) {
          setSelectedTable(result.tables[0].name);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoadingTables(false);
      }
    };
    loadTables();
  }, [jobId]);

  // Load table data
  const loadData = useCallback(async () => {
    if (!selectedTable) return;
    setIsLoadingData(true);
    try {
      const filters = Object.entries(filterValues)
        .filter(([, v]) => v.trim())
        .map(([col, val]) => `${col}:like:${val}`);

      const result = await api.getRelationalTableData(jobId, selectedTable, {
        limit,
        offset,
        sort: sortColumn || undefined,
        order: sortOrder,
        filter: filters.length > 0 ? filters : undefined,
      });
      setColumns(result.columns);
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoadingData(false);
    }
  }, [jobId, selectedTable, offset, sortColumn, sortOrder, filterValues]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
    setOffset(0);
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [column]: value }));
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      setOffset(0);
    }, 300);
  };

  const handleDoubleClick = (rowId: string, column: string, currentValue: unknown) => {
    setEditingCell({ rowId, column });
    setEditValue(currentValue == null ? '' : String(currentValue));
  };

  const handleSave = async () => {
    if (!editingCell || !selectedTable) return;
    setIsSaving(true);
    try {
      const result = await api.updateRelationalCell(
        jobId,
        selectedTable,
        editingCell.rowId,
        editingCell.column,
        editValue
      );
      // Update the row in-place
      setRows(prev =>
        prev.map(r =>
          String(r.id) === editingCell.rowId ? result.row : r
        )
      );
      setEditingCell(null);
    } catch (err) {
      setError(`Failed to save: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (isLoadingTables) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading tables...</span>
      </div>
    );
  }

  if (error && tables.length === 0) {
    return (
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No tables found in this export.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table selector */}
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium">Table:</label>
        <select
          value={selectedTable || ''}
          onChange={(e) => {
            setSelectedTable(e.target.value);
            setOffset(0);
            setSortColumn(null);
            setFilterValues({});
            setEditingCell(null);
          }}
          className="px-3 py-2 border rounded-md bg-background text-sm"
        >
          {tables.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.rowCount.toLocaleString()} rows)
            </option>
          ))}
        </select>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 border border-red-200 rounded-lg p-3 bg-red-50 flex items-center justify-between">
          <p className="text-sm text-red-800">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Data grid */}
      {isLoadingData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading data...</span>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead>
                {/* Sort headers */}
                <tr className="bg-muted/50">
                  {columns.map((col) => (
                    <th
                      key={col.name}
                      className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => handleSort(col.name)}
                    >
                      <div className="flex items-center gap-1">
                        {col.name}
                        <span className="text-xs text-muted-foreground">({col.type || 'TEXT'})</span>
                        {sortColumn === col.name ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Filter row */}
                <tr className="bg-muted/30 border-t">
                  {columns.map((col) => (
                    <th key={`filter-${col.name}`} className="px-2 py-1">
                      <Input
                        type="text"
                        placeholder="Filter..."
                        value={filterValues[col.name] || ''}
                        onChange={(e) => handleFilterChange(col.name, e.target.value)}
                        className="h-7 text-xs"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const rowId = String(row.id);
                  return (
                    <tr key={rowId} className="hover:bg-muted/30">
                      {columns.map((col) => {
                        const isEditing =
                          editingCell?.rowId === rowId && editingCell?.column === col.name;
                        const cellValue = row[col.name];

                        return (
                          <td
                            key={col.name}
                            className="px-4 py-2 text-sm max-w-xs"
                            onDoubleClick={() => handleDoubleClick(rowId, col.name, cellValue)}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  ref={editInputRef}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-7 text-sm"
                                  disabled={isSaving}
                                />
                                <button
                                  onClick={handleSave}
                                  disabled={isSaving}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="truncate block cursor-default" title={String(cellValue ?? '')}>
                                {cellValue == null ? (
                                  <span className="text-muted-foreground italic">null</span>
                                ) : (
                                  String(cellValue)
                                )}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {total > 0 ? offset + 1 : 0}-{Math.min(offset + limit, total)} of{' '}
              {total.toLocaleString()} rows
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                Next
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Double-click a cell to edit. Press Enter to save, Escape to cancel.
          </p>
        </>
      )}
    </div>
  );
}
