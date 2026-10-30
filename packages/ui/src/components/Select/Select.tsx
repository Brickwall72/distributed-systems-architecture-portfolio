// File: packages/ui/components/Select/Select.tsx
import React, { useId, useState, useRef, useEffect } from 'react';

export interface SelectOption {
  /** Unique domain identifier emitted via `onSelection` when chosen. */
  readonly id: string;
  /** Human-readable display label rendered inside the option element. */
  readonly name: string;
}

/**
 * Base domain props shared across select modes.
 */
export interface SelectBaseProps {
  /** Visible label text displayed above the select field. Linked to the input via `htmlFor`. */
  readonly label: string;

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
   * Display text for the default empty option or placeholder.
   * @default "-- Select --"
   */
  readonly placeholderText?: string;
}

export interface SingleSelectProps
  extends SelectBaseProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'multiple'> {
  readonly isMulti?: false;
  readonly selectedId?: string;
  readonly onSelection: (value: string) => void;
}

export interface MultiSelectProps
  extends SelectBaseProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'multiple'> {
  readonly isMulti: true;
  readonly selectedIds?: string[];
  readonly onSelection: (value: string[]) => void;
}

/**
 * Combined discriminated union props for `Select`.
 */
export type SelectProps = SingleSelectProps | MultiSelectProps;

export function Select(props: Readonly<SelectProps>) {
  const {
    label,
    options,
    isLoading = false,
    error = null,
    loadingText = 'Loading selections...',
    placeholderText = '-- Select --',
    ...rest
  } = props;

  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!props.isMulti) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [props.isMulti]);

  let content: React.ReactNode;

  if (isLoading) {
    content = <span className="block text-sm text-gray-500 py-1.5">{loadingText}</span>;
  } else if (error) {
    content = <span className="block text-sm text-red-600 font-medium py-1.5">Error: {error}</span>;
  } else if (props.isMulti) {
    // Multi-select custom dropdown implementation
    const selectedIds = props.selectedIds ?? [];
    const selectedSet = new Set(selectedIds);
    
    const displayText =
      selectedIds.length > 0
        ? options
            .filter((opt) => selectedSet.has(opt.id))
            .map((opt) => opt.name)
            .join(', ')
        : placeholderText;

    const handleToggleOption = (optId: string) => {
      const nextSelection = selectedSet.has(optId)
        ? selectedIds.filter((id) => id !== optId)
        : [...selectedIds, optId];
      
      if (typeof props.onSelection === 'function') {
        props.onSelection(nextSelection);
      }
    };

    content = (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          id={id}
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full p-2 text-left border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white text-gray-800 flex justify-between items-center"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`truncate ${selectedIds.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
            {displayText}
          </span>
          <svg className="w-4 h-4 ml-2 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <ul
            tabIndex={-1}
            role="listbox"
            className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
          >
            {options.length === 0 ? (
              <li className="text-gray-500 select-none relative py-2 pl-3 pr-9 cursor-default">
                No options available
              </li>
            ) : (
              options.map((opt) => {
                const isSelected = selectedSet.has(opt.id);
                return (
                  <li
                    key={opt.id}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation(); // Keep dropdown open
                      handleToggleOption(opt.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleOption(opt.id);
                      }
                    }}
                    className={`cursor-pointer select-none relative py-2.5 px-3 flex items-center transition-colors ${
                      isSelected 
                        ? 'bg-gray-200 text-gray-900 font-medium' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by <li> click handler to prevent event bubbling conflicts
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer mr-3"
                    />
                    <span className="truncate">{opt.name}</span>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    );
  } else {
    // Single-select native implementation (backward compatible)
    const singleProps = props as SingleSelectProps;
    content = (
      <select
        id={id}
        value={singleProps.selectedId ?? ''}
        onChange={(e) => {
          if (typeof singleProps.onSelection === 'function') {
            singleProps.onSelection(e.target.value);
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