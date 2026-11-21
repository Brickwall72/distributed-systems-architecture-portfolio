// File: packages/ui/src/components/TableView/TableView.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseTwinTable, TableColumn } from './TableView';

interface TestUser {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
}

const mockData: TestUser[] = [
  { id: 'usr-1', name: 'Alice Johnson', status: 'Active' },
  { id: 'usr-2', name: 'Bob Smith', status: 'Inactive' },
];

const mockColumns: TableColumn<TestUser>[] = [
  { key: 'name', header: 'User Name' },
  { 
    key: 'status', 
    header: 'Account Status',
    render: (value) => <span data-testid="status-badge">{String(value).toUpperCase()}</span>,
  },
];

describe('DatabaseTwinTable', () => {
  it('renders table headers and row data correctly with default formatting', () => {
    render(
      <DatabaseTwinTable 
        columns={mockColumns} 
        data={mockData} 
        rowKey="id" 
      />
    );

    // Verify headers render
    expect(screen.getByText('User Name')).toBeDefined();
    expect(screen.getByText('Account Status')).toBeDefined();

    // Verify standard text rendering fallback
    expect(screen.getByText('Alice Johnson')).toBeDefined();
    expect(screen.getByText('Bob Smith')).toBeDefined();
  });

  it('applies custom render functions for columns when provided', () => {
    render(
      <DatabaseTwinTable 
        columns={mockColumns} 
        data={mockData} 
        rowKey="id" 
      />
    );

    // Verify custom render output (e.g., transformed to uppercase via render function)
    const badges = screen.getAllByTestId('status-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toBe('ACTIVE');
    expect(badges[1].textContent).toBe('INACTIVE');
  });

  it('renders an empty table structure gracefully when provided empty data', () => {
    const { container } = render(
      <DatabaseTwinTable 
        columns={mockColumns} 
        data={[]} 
        rowKey="id" 
      />
    );

    const table = container.querySelector('table');
    expect(table).toBeDefined();
    
    // Headers should still be present
    expect(screen.getByText('User Name')).toBeDefined();
    
    // No rows should exist in tbody
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(0);
    expect(screen.getByText('0–0 of 0 rows')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('paginates rows and preserves selection and keyboard interaction on later pages', () => {
    const data: TestUser[] = Array.from({ length: 16 }, (_, index) => ({
      id: `usr-${index + 1}`, name: `User ${index + 1}`, status: 'Active',
    }));
    const onRowSelect = vi.fn();
    render(<DatabaseTwinTable columns={mockColumns} data={data} rowKey="id" onRowSelect={onRowSelect} selectedRowKey="usr-6" />);

    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('5');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['5', '10', '15']);
    expect(screen.getByText('1–5 of 16 rows')).toBeInTheDocument();
    expect(screen.queryByText('User 6')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('6–10 of 16 rows')).toBeInTheDocument();
    expect(screen.getByText('User 6').closest('tr')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByText('User 6').closest('tr')!, { key: 'Enter' });
    expect(onRowSelect).toHaveBeenCalledWith(data[5]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('16–16 of 16 rows')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('User 11')).toBeInTheDocument();
  });

  it('resets to the first page when page size changes and clamps after data shrinks', () => {
    const data: TestUser[] = Array.from({ length: 26 }, (_, index) => ({
      id: `usr-${index + 1}`, name: `User ${index + 1}`, status: 'Active',
    }));
    const { rerender } = render(<DatabaseTwinTable columns={mockColumns} data={data} rowKey="id" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '10' } });
    expect(screen.getByText('1–10 of 26 rows')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '5' } });
    expect(screen.getByText('1–5 of 26 rows')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('11–15 of 26 rows')).toBeInTheDocument();
    rerender(<DatabaseTwinTable columns={mockColumns} data={data.slice(0, 7)} rowKey="id" />);
    expect(screen.getByText('6–7 of 7 rows')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    rerender(<DatabaseTwinTable columns={mockColumns} data={data} rowKey="id" />);
    expect(screen.getByText('6–10 of 26 rows')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '15' } });
    expect(screen.getByText('1–15 of 26 rows')).toBeInTheDocument();
    expect(screen.queryByText('User 16')).not.toBeInTheDocument();
  });

  it('invokes onRowSelect and marks the selected row', () => {
    const onRowSelect = vi.fn();
    render(
      <DatabaseTwinTable columns={mockColumns} data={mockData} rowKey="id" onRowSelect={onRowSelect} selectedRowKey="usr-2" />
    );

    fireEvent.click(screen.getByText('Alice Johnson'));
    expect(onRowSelect).toHaveBeenCalledWith(mockData[0]);

    const rows = screen.getAllByRole('row');
    expect(rows[2]).toHaveAttribute('aria-selected', 'true');
    expect(rows[1]).toHaveAttribute('aria-selected', 'false');
    expect(rows[2]).toHaveClass('bg-blue-900');
    expect(rows[1]).not.toHaveClass('bg-blue-900');
  });

  describe('isRowSelectable', () => {
    const isRowSelectable = (row: TestUser) => row.status === 'Active';

    it('does not invoke onRowSelect or expose selection semantics for non-selectable rows', () => {
      const onRowSelect = vi.fn();
      render(
        <DatabaseTwinTable columns={mockColumns} data={mockData} rowKey="id" onRowSelect={onRowSelect} isRowSelectable={isRowSelectable} />
      );

      const [, selectableRow, lockedRow] = screen.getAllByRole('row');
      expect(selectableRow).toHaveAttribute('tabindex', '0');
      expect(lockedRow).not.toHaveAttribute('tabindex');
      expect(lockedRow).not.toHaveAttribute('aria-selected');
      expect(lockedRow.className).not.toContain('cursor-pointer');

      fireEvent.click(screen.getByText('Bob Smith'));
      fireEvent.keyDown(lockedRow, { key: 'Enter' });
      expect(onRowSelect).not.toHaveBeenCalled();
    });

    it('still invokes onRowSelect for selectable rows via click, Enter and Space', () => {
      const onRowSelect = vi.fn();
      render(
        <DatabaseTwinTable columns={mockColumns} data={mockData} rowKey="id" onRowSelect={onRowSelect} isRowSelectable={isRowSelectable} />
      );
      const selectableRow = screen.getAllByRole('row')[1];

      fireEvent.click(selectableRow);
      fireEvent.keyDown(selectableRow, { key: 'Enter' });
      fireEvent.keyDown(selectableRow, { key: ' ' });
      fireEvent.keyDown(selectableRow, { key: 'a' });

      expect(onRowSelect).toHaveBeenCalledTimes(3);
      expect(onRowSelect).toHaveBeenCalledWith(mockData[0]);
    });

    it('treats every row as non-interactive when no onRowSelect is provided', () => {
      render(<DatabaseTwinTable columns={mockColumns} data={mockData} rowKey="id" isRowSelectable={() => true} />);

      for (const row of screen.getAllByRole('row').slice(1)) {
        expect(row).not.toHaveAttribute('tabindex');
        expect(row).not.toHaveAttribute('aria-selected');
      }
    });
  });
});
