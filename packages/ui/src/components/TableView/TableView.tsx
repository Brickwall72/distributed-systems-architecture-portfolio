// File: packages/ui/src/components/TableView/TableView.tsx
import React, { useEffect, useState } from 'react';
import '@shared/styles';
import { Select } from '../Select';

const PAGE_SIZES = [5, 10, 15] as const;
const PAGE_SIZE_OPTIONS = PAGE_SIZES.map((size) => ({ id: String(size), name: String(size) }));

function getRowHighlightClass(isSelected: boolean, isInteractive: boolean): string {
  if (isSelected) return 'bg-blue-900';
  if (isInteractive) return 'hover:bg-gray-900';
  return '';
}

export interface TableColumn<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface DatabaseTwinProps<T> {
  readonly columns: readonly TableColumn<T>[];
  readonly data: readonly T[];
  readonly rowKey: keyof T;
  readonly onRowSelect?: (row: T) => void;
  readonly selectedRowKey?: T[keyof T] | null;
  readonly isRowSelectable?: (row: T) => boolean; // Added to control interactivity per row
}

export function DatabaseTwinTable<T>({ 
  columns, 
  data, 
  rowKey, 
  onRowSelect, 
  selectedRowKey,
  isRowSelectable 
}: DatabaseTwinProps<T>) {
  const [pageSize, setPageSize] = useState<number>(5);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * pageSize;
  const end = Math.min(start + pageSize, data.length);

  useEffect(() => {
    setPage((previousPage) => Math.min(previousPage, pageCount - 1));
  }, [pageCount]);

  return (
    <div className="rounded-lg border border-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900 text-gray-200">
              {columns.map((col) => (
                <th key={String(col.key)} className="p-3 font-semibold text-sm">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-950 text-gray-300">
            {data.slice(start, end).map((row) => {
              const isSelected = selectedRowKey != null && row[rowKey] === selectedRowKey;
              const selectable = isRowSelectable ? isRowSelectable(row) : !!onRowSelect;
              const isInteractive = selectable && !!onRowSelect;

              return (
                <tr
                  key={String(row[rowKey])}
                  className={`transition-colors ${isInteractive ? 'cursor-pointer' : ''} ${getRowHighlightClass(isSelected, isInteractive)}`}
                  aria-selected={isInteractive ? isSelected : undefined}
                  tabIndex={selectable && onRowSelect ? 0 : undefined}
                  onClick={selectable && onRowSelect ? () => onRowSelect(row) : undefined}
                  onKeyDown={
                    selectable && onRowSelect
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowSelect(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="p-3 text-sm">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav aria-label="Table pagination" className="flex flex-wrap items-end justify-between gap-4 border-t border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200">
        <div className="w-32 [&_.selector-field]:mb-0 [&_label]:text-gray-200">
          <Select
            label="Rows per page"
            options={PAGE_SIZE_OPTIONS}
            selectedId={String(pageSize)}
            showPlaceholder={false}
            onSelection={(value) => {
              const size = PAGE_SIZES.find((option) => String(option) === value);
              if (size === undefined) throw new Error(`Invalid page size: ${value}`);
              setPageSize(size);
              setPage(0);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span aria-live="polite">
            {data.length === 0 ? 0 : start + 1}–{end} of {data.length} rows
          </span>
          <button
            type="button"
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>Page {currentPage + 1} of {pageCount}</span>
          <button
            type="button"
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentPage === pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </nav>
    </div>
  );
}