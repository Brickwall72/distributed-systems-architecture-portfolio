// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow.tsx
import { useState, useMemo } from 'react';
import { DocumentViewer, hydrateTemplate } from '@shared/ui-components';
import { SignatureOverlay } from 'esign-client';
import { GeneratePdfButton } from 'pdf-client';

// Native import since this widget lives inside compliance_client
import TemplateSelector from './TemplateSelector'; 

export interface ComplianceWorkflowProps {
  /** The generic JSON dictionary used to hydrate the template */
  templateData: Record<string, unknown> | null;
  documentId: string;
  requisitionNumber: string;
  signerId: string;
  entityId: string;
  onWorkflowComplete?: (signedPdfUrl: string) => void;
}

export default function ComplianceWorkflowWidget({
  templateData,
  documentId,
  requisitionNumber,
  signerId,
  entityId,
  onWorkflowComplete
}: Readonly<ComplianceWorkflowProps>) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [rawTemplateHtml, setRawTemplateHtml] = useState<string>('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  const handleTemplateLoad = (templateId: string, rawHtml: string) => {
    setSelectedTemplateId(templateId);
    setRawTemplateHtml(rawHtml);
    setPdfBlobUrl(null);
    setIsSigning(false);
    setIsSigned(false);
  };

  const isReadyForPdf = Boolean(templateData && selectedTemplateId);

  const hydratedHtml = useMemo(() => {
    if (!rawTemplateHtml) return '';
    if (!templateData) return rawTemplateHtml;
    return hydrateTemplate(rawTemplateHtml, templateData);
  }, [rawTemplateHtml, templateData]);

  const handleSignatureSuccess = (signedPdfUrl: string) => {
    setPdfBlobUrl(signedPdfUrl);
    setIsSigned(true);
    setIsSigning(false);
    if (onWorkflowComplete) onWorkflowComplete(signedPdfUrl);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Workflow Controls Header */}
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="w-72">
          <TemplateSelector
            label="Compliance Form"
            selectedId={selectedTemplateId}
            onTemplateLoad={handleTemplateLoad}
          />
        </div>

        <div className="flex items-center gap-3">
          {pdfBlobUrl && (
            <button
              onClick={() => setPdfBlobUrl(null)}
              className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded-md transition"
            >
              Back to Interactive View
            </button>
          )}

          <GeneratePdfButton
            htmlPayload={isReadyForPdf ? hydratedHtml : ''}
            fileName={`${selectedTemplateId || 'document'}-${requisitionNumber}.pdf`}
            onSuccess={setPdfBlobUrl}
          />
        </div>
      </div>

      {/* Document Workspace */}
      <div className="flex-1 bg-white rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative min-h-[600px]">
        <DocumentViewer
          content={pdfBlobUrl ?? hydratedHtml}
          contentType={pdfBlobUrl ? 'pdf' : 'html'}
          title={`Document Workflow: ${requisitionNumber}`}
          className="w-full h-full"
          isSigningActive={isSigning}
        >
          <div className="absolute bottom-4 right-4 z-10">
            <button
              onClick={() => setIsSigning(true)}
              disabled={!pdfBlobUrl || isSigned || isSigning}
              className="px-3 py-1.5 w-40 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-md transition shadow"
            >
              {isSigned ? 'Signed' : 'Sign Document'}
            </button>
          </div>

          {isSigning && pdfBlobUrl && (
            <SignatureOverlay
              pdfBlobUrl={pdfBlobUrl}
              documentId={documentId}
              signerId={signerId}
              entityId={entityId}
              customPath={`transfers/${selectedTemplateId || 'forms'}/${requisitionNumber}`}
              documentType={selectedTemplateId}
              onCancel={() => setIsSigning(false)}
              onSuccess={handleSignatureSuccess}
            />
          )}
        </DocumentViewer>
      </div>
    </div>
  );
}