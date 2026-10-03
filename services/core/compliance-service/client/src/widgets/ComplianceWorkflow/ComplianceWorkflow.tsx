// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow.tsx
import { useState, useMemo } from 'react';
import { Button, DocumentViewer, hydrateTemplate } from '@shared/ui-components';
import { SignatureOverlay } from 'esign-client';
import { usePdfGenerator } from '@platform/pdf-client';

// Native import since this widget lives inside compliance_client
import TemplateSelector from '../TemplateSelector/TemplateSelector'; 

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

  const fileName = `${selectedTemplateId || 'document'}-${requisitionNumber}.pdf`;

  const { generate, isGenerating } = usePdfGenerator({
    fileName,
    onSuccess: (blobUrl) => setPdfBlobUrl(blobUrl),
    onError: (err) => console.error('Failed to generate PDF:', err),
  });

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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPdfBlobUrl(null)}
            >
              Back to Interactive View
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            isLoading={isGenerating}
            disabled={!isReadyForPdf || !hydratedHtml}
            onClick={() => generate(hydratedHtml)}
          >
            Generate PDF
          </Button>
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
            <Button
              variant="primary"
              disabled={!pdfBlobUrl || isSigned || isSigning}
              onClick={() => setIsSigning(true)}
              className="w-40 shadow"
            >
              {isSigned ? 'Signed' : 'Sign Document'}
            </Button>
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