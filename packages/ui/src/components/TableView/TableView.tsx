// File: packages/ui/src/components/TableView/TableView.tsx
import React from 'react';
import '@shared/styles';

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
}

export function DatabaseTwinTable<T>({ columns, data, rowKey, onRowSelect, selectedRowKey }: DatabaseTwinProps<T>) {
  return (
    <div className="dark overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="min-w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200">
            {columns.map((col) => (
              <th key={String(col.key)} className="p-3 font-semibold text-sm">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950 dark:text-gray-300">
          {data.map((row) => {
            const isSelected = selectedRowKey != null && row[rowKey] === selectedRowKey;
            return (
            <tr
              key={String(row[rowKey])}
              className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors${onRowSelect ? ' cursor-pointer' : ''}${isSelected ? ' bg-blue-50 dark:bg-blue-900/30' : ''}`}
              aria-selected={onRowSelect ? isSelected : undefined}
              tabIndex={onRowSelect ? 0 : undefined}
              onClick={onRowSelect ? () => onRowSelect(row) : undefined}
              onKeyDown={
                onRowSelect
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
  );
}