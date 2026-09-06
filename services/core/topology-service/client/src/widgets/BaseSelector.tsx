// File: services/core/topology-service/client/src/widgets/BaseSelector.tsx
import React, { useEffect, useState } from 'react';


interface BaseSelectorProps<T> {
  readonly label: string;
  readonly url: string;
  readonly dependency?: string;
  readonly selectedId?: string;
  readonly onChange: (item: T | null) => void;
  readonly getItemId: (item: T) => string;
  readonly renderOptionLabel: (item: T) => React.ReactNode;
  readonly loadingText: string;
  readonly placeholderText: string;
}

export default function BaseSelector<T>({
  label,
  url,
  dependency,
  selectedId,
  onChange,
  getItemId,
  renderOptionLabel,
  loadingText,
  placeholderText,
}: BaseSelectorProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch data');
        const data: T[] = await res.json();

        if (isMounted) {
          setItems(data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [url, dependency]);

  let selectorContent: React.ReactNode;

  if (loading) {
    selectorContent = <span className="block text-sm text-gray-500 py-1.5">{loadingText}</span>;
  } else if (error) {
    selectorContent = <span className="block text-sm text-red-600 font-medium py-1.5">Error: {error}</span>;
  } else {
    selectorContent = (
      <select
        value={selectedId || ''}
        onChange={(e) => {
          const found = items.find((item) => getItemId(item) === e.target.value);
          onChange(found ?? null);
        }}
        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white text-gray-800"
      >
        <option value="">{placeholderText}</option>
        {items.map((item) => {
          const id = getItemId(item);
          return (
            <option key={id} value={id}>
              {renderOptionLabel(item)}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <div className="selector-field mb-4">
      <label className="block font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      {selectorContent}
    </div>
  );
}