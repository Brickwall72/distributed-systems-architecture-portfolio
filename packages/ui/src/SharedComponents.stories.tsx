// File: packages/ui/src/components/SharedComponents.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { 
  DatabaseTwinTable, 
  TableColumn, 
  DatabaseTwinProps, 
  DocumentViewer, 
  FederatedErrorBoundary 
} from './components';

const meta: Meta = {
  title: 'Shared Components',
};

export default meta;

// ==========================================
// Document Viewer Stories
// ==========================================

export const HtmlPreview: StoryObj<typeof DocumentViewer> = {
  render: (args) => <DocumentViewer {...args} />,
  args: {
    content: `
      <div style="font-family: sans-serif; padding: 2rem; color: #333;">
        <h1 style="border-bottom: 2px solid #eaeaea; padding-bottom: 0.5rem;">Sample Template</h1>
        <p>This is what the raw HTML looks like before generating the PDF.</p>
      </div>
    `,
    contentType: 'html',
    title: 'HTML Template Preview',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '800px', height: '600px' }}>
        <Story />
      </div>
    ),
  ],
};

const localTestPdfUrl = new URL('../__fixtures__/example.pdf', import.meta.url).href;

export const PdfView: StoryObj<typeof DocumentViewer> = {
  render: (args) => <DocumentViewer {...args} />,
  args: {
    content: localTestPdfUrl,
    contentType: 'pdf',
    title: 'Generated PDF View',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '800px', height: '600px' }}>
        <Story />
      </div>
    ),
  ],
};

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

export const ErrorBoundaryNormal: StoryObj = {
  render: () => (
    <FederatedErrorBoundary remoteName="compliance_client">
      <div className="p-6 bg-emerald-950/30 border border-emerald-800/80 rounded-xl text-emerald-200 space-y-2 shadow-sm">
        <h4 className="font-semibold text-sm">Remote Widget Operational</h4>
        <p className="text-xs text-emerald-300/80">Successfully resolved widget from remote runtime registry peer.</p>
      </div>
    </FederatedErrorBoundary>
  ),
};

export const ErrorBoundaryTriggered: StoryObj = {
  render: () => {
    const BuggyWidget = () => {
      throw new Error('Network partition: failed to fetch /topology/client/mf-manifest.json');
    };

    return (
      <FederatedErrorBoundary remoteName="topology_client">
        <BuggyWidget />
      </FederatedErrorBoundary>
    );
  },
};