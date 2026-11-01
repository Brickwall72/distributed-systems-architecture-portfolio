// File: packages/ui/src/components/SharedComponents.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { 
  DatabaseTwinTable, 
  TableColumn, 
  DatabaseTwinProps, 
} from './TableView';

const meta: Meta<typeof DatabaseTwinTable> = {
  title: 'Shared Components/DatabaseTwinTable',
  component: DatabaseTwinTable,
  tags: ['autodocs'],
};

export default meta;

// ==========================================
// Table View (Database Twin) Stories
// ==========================================

interface MockTransferRecord {
  id: string;
  documentRef: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
}

const mockTableData: MockTransferRecord[] = [
  { id: 'tx-881', documentRef: 'doc-alpha-01.pdf', status: 'Approved', createdAt: '2026-09-10T14:30:00Z' },
  { id: 'tx-882', documentRef: 'doc-beta-02.pdf', status: 'Pending', createdAt: '2026-09-12T09:15:00Z' },
  { id: 'tx-883', documentRef: 'doc-gamma-03.pdf', status: 'Rejected', createdAt: '2026-09-13T18:25:57Z' },
];

const basicColumns: TableColumn<MockTransferRecord>[] = [
  { key: 'id', header: 'Transfer ID' },
  { key: 'documentRef', header: 'Document' },
  { key: 'status', header: 'Status' },
  { key: 'createdAt', header: 'Date Created' },
];

export const TableDefaultView: StoryObj<DatabaseTwinProps<MockTransferRecord>> = {
  render: (args) => <DatabaseTwinTable {...args} />,
  args: {
    columns: basicColumns,
    data: mockTableData,
    rowKey: 'id',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '1000px', padding: '2rem', fontFamily: 'sans-serif' }}>
        <Story />
      </div>
    ),
  ],
};

const customRenderColumns: TableColumn<MockTransferRecord>[] = [
  { key: 'id', header: 'Transfer ID' },
  { 
    key: 'documentRef', 
    header: 'Document',
    render: (value) => (
      <span className="text-blue-600 font-medium">{String(value)}</span>
    )
  },
  { 
    key: 'status', 
    header: 'State',
    render: (value) => {
      const statusStr = String(value);
      const colors: Record<string, string> = {
        Approved: 'bg-green-100 text-green-800',
        Pending: 'bg-yellow-100 text-yellow-800',
        Rejected: 'bg-red-100 text-red-800'
      };
      return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${colors[statusStr] || ''}`}>
          {statusStr}
        </span>
      );
    }
  },
  { 
    key: 'createdAt', 
    header: 'Date Created',
    render: (value) => new Date(String(value)).toLocaleDateString()
  },
];

export const TableCustomRenderView: StoryObj<DatabaseTwinProps<MockTransferRecord>> = {
  render: (args) => <DatabaseTwinTable {...args} />,
  args: {
    columns: customRenderColumns,
    data: mockTableData,
    rowKey: 'id',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '1000px', padding: '2rem', fontFamily: 'sans-serif' }}>
        <Story />
      </div>
    ),
  ],
};