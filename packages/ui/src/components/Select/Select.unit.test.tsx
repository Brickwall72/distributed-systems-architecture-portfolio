// File: packages/ui/components/Select/Select.unit.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Select } from './Select';

describe('Select Component', () => {
  const mockOptions = [
    { id: 'opt1', name: 'Option 1' },
    { id: 'opt2', name: 'Option 2' },
  ];

  it('renders correctly with options and default placeholder', () => {
    render(<Select label="Test Select" options={mockOptions} onSelection={vi.fn()} />);

    expect(screen.getByText('Test Select')).toBeInTheDocument();
    
    const select = screen.getByRole('combobox', { name: 'Test Select' });
    expect(select).toBeInTheDocument();
    
    // Placeholder + 2 options
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: '-- Select --' })).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
  });

  it('calls onValueChange when an option is selected', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    
    render(<Select label="Test Select" options={mockOptions} onSelection={handleValueChange} />);
    
    const select = screen.getByRole('combobox', { name: 'Test Select' });
    await user.selectOptions(select, 'opt2');

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith('opt2');
  });

  it('displays loading state correctly', () => {
    render(
      <Select 
        label="Test Select" 
        options={mockOptions} 
        onSelection={vi.fn()} 
        isLoading={true} 
        loadingText="Fetching data..."
      />
    );

    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('displays error state correctly', () => {
    render(
      <Select 
        label="Test Select" 
        options={mockOptions} 
        onSelection={vi.fn()} 
        error="Failed to load options"
      />
    );

    expect(screen.getByText('Error: Failed to load options')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('passes through standard HTML select attributes', () => {
    render(
      <Select 
        label="Test Select" 
        options={mockOptions} 
        onSelection={vi.fn()} 
        disabled={true}
        required={true}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Test Select' });
    expect(select).toBeDisabled();
    expect(select).toBeRequired();
  });
});