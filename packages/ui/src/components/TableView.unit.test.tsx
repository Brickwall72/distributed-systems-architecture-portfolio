// File: packages/ui/src/components/TableView.unit.test.tsx
import { render, screen } from '@testing-library/react';
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
  });
});