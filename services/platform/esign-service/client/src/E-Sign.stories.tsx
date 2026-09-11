// File: services/core/esignature-service/client/src/widgets/SignatureOverlayWidget.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SignatureOverlayWidget from './widgets/SignatureOverlay';
import { DocumentViewer } from '@shared/ui-components';

const meta: Meta<typeof SignatureOverlayWidget> = {
  title: 'Widgets/SignatureOverlayWidget',
  component: SignatureOverlayWidget,
  parameters: {
    layout: 'fullscreen', // Removes default Storybook padding for realistic shell testing
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SignatureOverlayWidget>;

// Realistic mock document to render underneath the canvas
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
    onSubmit: (signatureBase64: string) => {
      console.log('Submitted Signature:', signatureBase64);
    },
    onCancel: () => {
      console.log('Signature cancelled');
    },
  },
  render: (args) => {
    // Local state to simulate the UnifiedCustodyPage toggling
    const [isSigning, setIsSigning] = useState(true);

    return (
      <div className="w-full min-h-screen p-8 bg-slate-950 flex flex-col items-center gap-6">
        {/* Mock Shell Header */}
        <div className="w-full max-w-4xl flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
          <span className="text-slate-300 font-medium">Compliance Document Preview</span>
          <button 
            onClick={() => setIsSigning(!isSigning)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-500 transition shadow"
          >
            {isSigning ? 'Cancel E-Sign' : 'Trigger E-Sign'}
          </button>
        </div>
        
        {/* Integrated Viewer Workspace */}
        <main className="w-full max-w-4xl h-[750px] bg-white rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
          <DocumentViewer
            content={mockHtmlContent}
            contentType="html"
            title="Mock DD-1149 Document"
            className="w-full h-full"
            isSigningActive={isSigning}
          >
            {/* The slot for the overlay, matching the UnifiedCustodyPage implementation */}
            {isSigning && (
              <SignatureOverlayWidget 
                onCancel={() => {
                  setIsSigning(false);
                  args.onCancel();
                }} 
                onSubmit={(sig) => {
                  setIsSigning(false);
                  args.onSubmit(sig);
                  alert('Signature submitted! Check console for base64 output.');
                }} 
              />
            )}
          </DocumentViewer>
        </main>
      </div>
    );
  }
};