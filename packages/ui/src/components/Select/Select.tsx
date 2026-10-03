// File: packages/ui/components/Select/Select.ts
import React, { useId } from 'react';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  readonly label: string;
  readonly options: SelectOption[];
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly loadingText?: string;
  readonly placeholderText?: string;
  readonly onValueChange: (value: string) => void;
}

export function Select({
  label,
  options,
  value,
  isLoading = false,
  error = null,
  loadingText = 'Loading...',
  placeholderText = '-- Select --',
  onValueChange,
  ...rest
}: Readonly<SelectProps>) {
  const id = useId();

  let content: React.ReactNode;

  if (isLoading) {
    content = <span className="block text-sm text-gray-500 py-1.5">{loadingText}</span>;
  } else if (error) {
    content = <span className="block text-sm text-red-600 font-medium py-1.5">Error: {error}</span>;
  } else {
    content = (
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onValueChange(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
        {...rest}
      >
        <option value="">
          {placeholderText}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="selector-field mb-4">
      <label htmlFor={id} className="block font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      {content}
    </div>
  );
}