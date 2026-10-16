// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow.tsx
import { useState, useMemo, useEffect } from 'react';
import { Button, DocumentViewer, hydrateTemplate } from '@shared/ui-components';
import { SignatureOverlay, signDocument } from 'esign-client';
import { ComplianceWorkflowWidgetPropsSchema, type ComplianceWorkflowWidgetProps } from '@contracts/compliance';
import { TemplateSelector } from '../../components'; 
import { TemplateDTO } from 'compliance-shared';
import { generateTemplatePayload, PayloadParams } from '../../registry';
import { useCompliancePdf } from '../../hooks';
import '@shared/styles';

export default function ComplianceWorkflowWidget(props: Readonly<ComplianceWorkflowWidgetProps>) {
  const parsedProps = ComplianceWorkflowWidgetPropsSchema.safeParse(props);
  if (!parsedProps.success) {
    console.warn('[ComplianceWorkflowWidget MFE] Invalid props received from Host Shell:', parsedProps.error.format());
  }
  const entityData = parsedProps.success
    ? parsedProps.data
    : { sourceOrg: undefined, assets: [], targetOrg: undefined };

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDTO>();
  const [selectedDate] = useState(new Date().toDateString());
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  useEffect(() => {
    setPdfBlobUrl(null);
    setIsSigning(false);
    setIsSigned(false);
  }, [selectedTemplate?.id]);

  const templatePayloadInput: PayloadParams = useMemo(() => ({
    templateId: selectedTemplate?.id,
    input: {
      ...entityData,
      selectedDate,
    }
  }), [entityData, selectedDate]);

  const { generatePdf, isLoading, error } = useCompliancePdf();

  const displayPayload = useMemo(() => {
    if (!selectedTemplate?.id) return null;
    return generateTemplatePayload(templatePayloadInput);
  }, [templatePayloadInput]);

  const isReadyForPdf = Boolean(
    !pdfBlobUrl && 
    selectedTemplate?.id && 
    (entityData.assets?.length ?? 0) > 0 && 
    entityData.sourceOrg && 
    entityData.targetOrg
  );

  const hydratedHtml = useMemo(() => {
    if (!selectedTemplate?.rawHTML || !displayPayload) return '';
    return hydrateTemplate(selectedTemplate.rawHTML, displayPayload);
  }, [selectedTemplate?.rawHTML, displayPayload]);

  const signerId = 'usr_compliance_officer';
  const entityId = 'org_unassigned';
  const [documentId] = useState(() => crypto.randomUUID());
  const onWorkflowComplete = (signedPdfUrl: string) => console.log('Final Signed Document:', signedPdfUrl);

  // Injected functionality handler
  const handleSign = async (signatureDataUrl: string) => {
    if (!pdfBlobUrl) throw new Error('No PDF blob available to sign.');

    const signedPdfUrl = await signDocument({
      pdfBlobUrl,
      signatureDataUrl,
      documentId,
      signerId,
      entityId,
      customPath: `transfers/${selectedTemplate?.id || 'forms'}/document`,
      documentType: selectedTemplate?.id,
    });

    setPdfBlobUrl(signedPdfUrl);
    setIsSigned(true);
    setIsSigning(false);
    if (onWorkflowComplete) onWorkflowComplete(signedPdfUrl);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="w-72">
          <TemplateSelector
            label="Compliance Form"
            onSelect={setSelectedTemplate}
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
            isLoading={isLoading}
            disabled={!isReadyForPdf || Boolean(pdfBlobUrl)}
            onClick={() => generatePdf(templatePayloadInput, setPdfBlobUrl)}
          >
            Generate PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-white rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative min-h-[600px]">
        <DocumentViewer
          content={pdfBlobUrl ?? hydratedHtml}
          contentType={pdfBlobUrl ? 'pdf' : 'html'}
          title="Document Workflow"
          className="w-full h-full"
          isSigningActive={isSigning}
        >
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              disabled={!pdfBlobUrl || isSigned || isSigning}
              onClick={() => setIsSigning(true)}
              className="w-40 shadow"
            >
              {isSigned ? 'Signed' : 'Sign Document'}
            </Button>
          </div>

          {isSigning && pdfBlobUrl && (
            <SignatureOverlay
              documentId={documentId}
              onCancel={() => setIsSigning(false)}
              onSign={handleSign}
            />
          )}
        </DocumentViewer>
      </div>
    </div>
  );
}