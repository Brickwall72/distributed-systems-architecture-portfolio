// File: services/platform/esignature-service/client/src/E-Sign.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SignatureOverlay } from './widgets';
import { DocumentViewer } from '@shared/ui-components';

const meta: Meta<typeof SignatureOverlay> = {
  title: 'Widgets/SignatureOverlay',
  component: SignatureOverlay,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SignatureOverlay>;

const mockHtmlContent = `
  <div style="padding: 40px; font-family: serif; color: #1e293b; line-height: 1.6;">
    <h1 style="border-bottom: 2px solid #cbd5e1; padding-bottom: 10px;">Form DD-1149: Requisition and Invoice/Shipping Document</h1>
    <div style="margin-top: 20px;">
      <p><strong>From:</strong> Sector 7 Logistics Node</p>
      <p><strong>To:</strong> Forward Operating Base Zeta</p>
      <p><strong>Requisition No:</strong> REQ-2026-001</p>
    </div>
    
    <table style="width: 100%; margin-top: 30px; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #94a3b8;">
        <th style="text-align: left; padding: 8px;">Item</th>
        <th style="text-align: left; padding: 8px;">Nomenclature</th>
        <th style="text-align: left; padding: 8px;">Qty</th>
      </tr>
      <tr>
        <td style="padding: 8px;">1</td>
        <td style="padding: 8px;">Quantum Field Generator (S/N: QFG-9921)</td>
        <td style="padding: 8px;">1 EA</td>
      </tr>
    </table>

    <div style="margin-top: 100px;">
      <p><strong>Receiver Certification:</strong></p>
      <p>I certify that the items listed above have been received in apparent good condition.</p>
    </div>
  </div>
`;

export const IntegratedWithViewer: Story = {
  args: {
    pdfBlobUrl: 'blob:http://localhost:3000/mock-document-blob-id',
    documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    signerId: 'usr-actor-404',
    entityId: 'org-armory-01',
    documentType: 'DD-1149',
    customPath: '/docs/signed',
    onSuccess: (signedPdfBlobUrl: string) => {
      console.log('Signature applied successfully. Signed Blob URL:', signedPdfBlobUrl);
    },
    onCancel: () => {
      console.log('Signature cancelled');
    },
  },
  render: (args) => {
    const [isSigning, setIsSigning] = useState(true);

    return (
      <div className="w-full min-h-screen p-8 bg-slate-950 flex flex-col items-center gap-6">
        <div className="w-full max-w-4xl flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
          <span className="text-slate-300 font-medium">Compliance Document Preview</span>
          <button 
            onClick={() => setIsSigning(!isSigning)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-500 transition shadow"
          >
            {isSigning ? 'Cancel E-Sign' : 'Trigger E-Sign'}
          </button>
        </div>
        
        <main className="w-full max-w-4xl h-[750px] bg-white rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
          <DocumentViewer
            content={mockHtmlContent}
            contentType="html"
            title="Mock DD-1149 Document"
            className="w-full h-full"
            isSigningActive={isSigning}
          >
            {isSigning && (
              <SignatureOverlay 
                pdfBlobUrl={args.pdfBlobUrl}
                documentId={args.documentId}
                signerId={args.signerId}
                entityId={args.entityId}
                documentType={args.documentType}
                customPath={args.customPath}
                onCancel={() => {
                  setIsSigning(false);
                  args.onCancel();
                }} 
                onSuccess={(signedPdfUrl) => {
                  setIsSigning(false);
                  args.onSuccess(signedPdfUrl);
                  alert('Signature submitted! Check console for signed PDF blob URL.');
                }} 
              />
            )}
          </DocumentViewer>
        </main>
      </div>
    );
  },
};