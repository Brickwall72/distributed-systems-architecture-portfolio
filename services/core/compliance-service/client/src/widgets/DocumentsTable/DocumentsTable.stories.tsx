// File: services/core/compliance-service/client/src/widgets/DocumentsTable/DocumentsTable.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse, delay } from 'msw';
import DocumentsTable from './DocumentsTable';
import '@shared/styles';

const meta: Meta = {
  title: 'Widgets/Compliance Client/DocumentsTable',
  component: DocumentsTable,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl p-6 bg-slate-950 rounded-xl border border-slate-800 text-slate-100 shadow-xl min-h-[400px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;

// =============================================================================
// Schema-Compliant Mock Datasets & Shared MSW Handlers
// =============================================================================
const mockDocuments = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    document_type: 'DD-1149',
    s3_uri: 's3://compliance-vault/2026/dd1149-requisition-001.pdf',
    status: 'Approved',
    created_at: '2026-09-15T14:32:00Z',
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174001',
    document_type: 'DD-250',
    s3_uri: 's3://compliance-vault/2026/dd250-receiving-089.pdf',
    status: 'Pending',
    created_at: '2026-09-28T09:15:00Z',
  },
  {
    id: '323e4567-e89b-12d3-a456-426614174002',
    document_type: 'SECURITY_AUDIT',
    s3_uri: 's3://compliance-vault/2026/audit-chk-402.pdf',
    status: 'Approved',
    created_at: '2026-09-30T18:45:00Z',
  },
];

const sharedMswHandlers = [
  // Documents API
  http.get('/compliance/api/v1/documents/', () => {
    return HttpResponse.json(mockDocuments);
  }),

  // Template Selector API - Manifest
  http.get('/compliance/api/v1/templates', () => {
    return HttpResponse.json([
      { id: 'dd-1149', name: 'DD Form 1149 (Requisition & Invoice)' },
      { id: 'dd-250', name: 'DD Form 250 (Material Inspection & Receiving)' },
      { id: 'custom-audit', name: 'Custom Field Audit Checklist v2' },
    ]);
  }),

  // Template Selector API - Template Content
  http.get('/compliance/api/v1/templates/:id', ({ params }) => {
    const { id } = params;
    
    if (id === 'dd-250') {
      return new HttpResponse(
        `<!DOCTYPE html><html><body style="font-family: sans-serif; padding: 1.5rem; color: #1e293b;">
          <h2 style="border-bottom: 2px solid #0284c7; padding-bottom: 0.5rem; color: #0369a1;">DD Form 250 - Material Inspection & Receiving</h2>
          <p><strong>Inspection Asset:</strong> {{nomenclature}}</p>
          <p style="font-size: 0.875rem; color: #64748b;">Contractor verification block.</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    if (id === 'custom-audit') {
      return new HttpResponse(
        `<!DOCTYPE html><html><body style="font-family: sans-serif; padding: 1.5rem; color: #1e293b;">
          <h2 style="border-bottom: 2px solid #059669; padding-bottom: 0.5rem; color: #047857;">Custom Field Audit Checklist</h2>
          <p><strong>Auditing Entity:</strong> {{releasingEntityName}}</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    return new HttpResponse(
      `<!DOCTYPE html><html><body style="font-family: sans-serif; padding: 1.5rem; color: #1e293b;">
        <h2 style="border-bottom: 2px solid #4f46e5; padding-bottom: 0.5rem; color: #4338ca;">DD Form 1149 - Requisition and Invoice</h2>
        <p><strong>Transfer From:</strong> {{releasingEntityName}}</p>
        <p><strong>Transfer To:</strong> {{receivingEntityName}}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }),
];

// =============================================================================
// Widget 1: DocumentsTable Stories
// =============================================================================
export const DocumentsTableDefault: StoryObj<typeof DocumentsTable> = {
  name: 'Documents Table / Default',
  render: () => <DocumentsTable />,
  parameters: {
    msw: {
      handlers: sharedMswHandlers,
    },
  },
};

export const DocumentsTableEmpty: StoryObj<typeof DocumentsTable> = {
  name: 'Documents Table / Empty Ledger',
  render: () => <DocumentsTable />,
  parameters: {
    msw: {
      handlers: [
        http.get('/compliance/api/v1/documents/', () => {
          return HttpResponse.json([]);
        }),
      ],
    },
  },
};

export const DocumentsTableLoading: StoryObj<typeof DocumentsTable> = {
  name: 'Documents Table / Querying State',
  render: () => <DocumentsTable />,
  parameters: {
    msw: {
      handlers: [
        http.get('/compliance/api/v1/documents/', async () => {
          await delay('infinite');
          return HttpResponse.json([]);
        }),
      ],
    },
  },
};

export const DocumentsTableError: StoryObj<typeof DocumentsTable> = {
  name: 'Documents Table / API Connection Error',
  render: () => <DocumentsTable />,
  parameters: {
    msw: {
      handlers: [
        http.get('/compliance/api/v1/documents/', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
};