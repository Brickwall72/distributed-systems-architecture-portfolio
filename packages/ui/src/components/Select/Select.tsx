// File: packages/ui/components/Select/Select.tsx
import React, { useId } from 'react';

export interface SelectOption {
  /** Unique domain identifier emitted via `onSelection` when chosen. */
  readonly id: string;
  /** Human-readable display label rendered inside the `<option>` element. */
  readonly name: string;
}

/**
 * Pure domain props required by the `Select` component.
 */
export interface SelectCustomProps {
  /** Visible label text displayed above the select field. Linked to the input via `htmlFor`. */
  readonly label: string;

  /**
   * The currently active option ID. Pass `""` or `undefined` to display the placeholder option.
   */
  readonly selectedId?: string;

  /** Array of selectable domain options. */
  readonly options: SelectOption[];

  /**
   * When `true`, replaces the dropdown control with a loading indicator.
   * @default false
   */
  readonly isLoading?: boolean;

  /**
   * Error message string. When provided, replaces the dropdown control with an error callout.
   * @default null
   */
  readonly error?: string | null;

  /**
   * Message rendered when `isLoading` is `true`.
   * @default "Loading selections..."
   */
  readonly loadingText?: string;

  /**
   * Display text for the default empty option (`value=""`).
   * @default "-- Select --"
   */
  readonly placeholderText?: string;

  /**
   * Callback fired when the user selects an option.
   * @param value - The `id` of the newly chosen option, or `""` if placeholder was chosen.
   */
  readonly onSelection: (value: string) => void;
}

/**
 * Combined props for `Select`, blending custom props with native `<select>` attributes.
 */
export type SelectProps = SelectCustomProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>;

export function Select({
  label,
  selectedId,
  options,
  isLoading = false,
  error = null,
  loadingText = 'Loading selections...',
  placeholderText = '-- Select --',
  onSelection,
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
        value={selectedId ?? ''}
        onChange={(e) => {
          if (typeof onSelection === 'function') {
            onSelection(e.target.value);
          }
        }}
        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
        {...rest}
      >
        <option value="">{placeholderText}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
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