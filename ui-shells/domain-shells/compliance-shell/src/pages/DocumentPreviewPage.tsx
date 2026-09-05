// File: services/apps/compliance-shell/src/pages/DocumentPreviewPage.tsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { DocumentViewer } from '@shared/ui-components';

const GeneratePdfButton = lazy(() => import('pdf_client/GeneratePdfButton'));

const SAMPLE_HTML_TEMPLATE = `
  <!DOCTYPE html>
<html lang="en">
  <head>
      <meta charset="UTF-8">
      <title>Transfer of Custody - DD1149 Sim</title>
      <style>
          body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-size: 12px;
              color: #333;
              margin: 0;
              padding: 40px;
          }
          .header-title {
              text-align: center;
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 20px;
              text-transform: uppercase;
          }
          .form-grid {
              display: table;
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
          }
          .grid-row {
              display: table-row;
          }
          .grid-cell {
              display: table-cell;
              border: 1px solid #000;
              padding: 8px;
              vertical-align: top;
              width: 50%;
          }
          .label {
              font-size: 10px;
              font-weight: bold;
              text-transform: uppercase;
              display: block;
              margin-bottom: 4px;
          }
          .table-items {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
          }
          .table-items th, .table-items td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
          }
          .table-items th {
              font-size: 10px;
              background-color: #f3f4f6;
          }
          .signature-block {
              border: 1px solid #000;
              padding: 15px;
              margin-top: 30px;
          }
          .sig-line {
              border-bottom: 1px solid #000;
              width: 250px;
              display: inline-block;
              margin-left: 10px;
          }
      </style>
  </head>
  <body>

      <div class="header-title">
          Requisition and Invoice / Shipping Document<br>
          (Simulated Transfer of Custody)
      </div>

      <!-- Routing Information -->
      <div class="form-grid">
          <div class="grid-row">
              <div class="grid-cell">
                  <span class="label">1. From (Transferring Entity):</span>
                  <strong>{{fromEntityName}}</strong><br>
                  {{fromAddressLine1}}<br>
                  {{fromAddressLine2}}
              </div>
              <div class="grid-cell">
                  <span class="label">2. To (Receiving Entity):</span>
                  <strong>{{toEntityName}}</strong><br>
                  {{toAddressLine1}}<br>
                  {{toAddressLine2}}
              </div>
          </div>
          <div class="grid-row">
              <div class="grid-cell">
                  <span class="label">3. Authority / Requisition Number:</span>
                  {{requisitionNumber}}
              </div>
              <div class="grid-cell">
                  <span class="label">4. Date of Transfer (YYYYMMDD):</span>
                  {{transferDate}}
              </div>
          </div>
      </div>

      <!-- Asset Data -->
      <table class="table-items">
          <thead>
              <tr>
                  <th>Item No.</th>
                  <th>Asset Description & Serial Number</th>
                  <th>Unit of Issue</th>
                  <th>Quantity</th>
              </tr>
          </thead>
          <tbody>
              {{#each items}}
              <tr>
                  <td>{{this.itemNumber}}</td>
                  <td>
                      <strong>{{this.nomenclature}}</strong><br>
                      S/N: {{this.serialNumber}}<br>
                      <em>{{this.additionalNotes}}</em>
                  </td>
                  <td>{{this.unit}}</td>
                  <td>{{this.quantity}}</td>
              </tr>
              {{/each}}
          </tbody>
      </table>

      <!-- Signature Block -->
      <div class="signature-block">
          <span class="label">Receipt Certification</span>
          <p>I certify that the assets listed above have been received and custody has been formally transferred.</p>
          <div style="margin-top: 30px; display: flex; justify-content: space-between;">
              <div>
                  <strong>Authorized Receiver:</strong> <span class="sig-line"></span>
              </div>
              <div>
                  <strong>Date:</strong> <span class="sig-line" style="width: 150px;"></span>
              </div>
          </div>
      </div>

  </body>
</html>
`;

export default function DocumentPreviewPage() {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Clean up object URLs to prevent memory leaks on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // Accepts the blobUrl string directly from GeneratePdfButton
  const handlePdfSuccess = (newBlobUrl: string) => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
    }
    setPdfBlobUrl(newBlobUrl);
  };

  return (
    <div className="flex flex-col h-screen p-6 gap-4 bg-slate-50">
      <header className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Compliance Shell Viewer</h2>
          <p className="text-sm text-slate-500">
            {pdfBlobUrl ? 'Mode: Rendered PDF (In-Memory Blob)' : 'Mode: HTML Preview'}
          </p>
        </div>

        <div className="flex gap-3 items-center">
          {pdfBlobUrl && (
            <button
              onClick={() => setPdfBlobUrl(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Reset to HTML View
            </button>
          )}

          <Suspense fallback={<div className="text-sm text-slate-400">Loading widget...</div>}>
            <GeneratePdfButton
              htmlPayload={SAMPLE_HTML_TEMPLATE}
              fileName="audit-report.pdf"
              buttonText="Generate PDF"
              onSuccess={handlePdfSuccess}
              onError={(err: Error) => console.error('PDF Generation Failed:', err)}
            />
          </Suspense>
        </div>
      </header>

      <main className="flex-1 min-h-0 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <DocumentViewer
          content={pdfBlobUrl ?? SAMPLE_HTML_TEMPLATE}
          contentType={pdfBlobUrl ? 'pdf' : 'html'}
          className="w-full h-full"
          title="Compliance Document Preview"
          placeholder={
            <div className="flex items-center justify-center h-full text-slate-400">
              No document loaded.
            </div>
          }
        />
      </main>
    </div>
  );
};