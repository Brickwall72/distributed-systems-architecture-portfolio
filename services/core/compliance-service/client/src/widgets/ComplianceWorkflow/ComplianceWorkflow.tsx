// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow.tsx
import { useState, useMemo, useEffect } from 'react';
import { Button, DocumentViewer, hydrateTemplate } from '@shared/ui-components';
import { SignatureOverlay } from 'esign-client';
import { ComplianceWorkflowWidgetPropsSchema, type ComplianceWorkflowWidgetProps } from '@contracts/compliance';
import { TemplateSelector } from '../../components'; 
import { TemplateDTOwithPayloadSchema, masterPayloadInputSchema } from 'compliance-shared';
import { useGeneratePdf, useSignPdf, signPdfParamsSchema } from '../../hooks';
import '@shared/styles';

export default function ComplianceWorkflowWidget(props: Readonly<ComplianceWorkflowWidgetProps>) {
  const parsedProps = ComplianceWorkflowWidgetPropsSchema.safeParse(props);
  if (!parsedProps.success) {
    console.warn('[ComplianceWorkflowWidget MFE] Invalid props received from Host Shell:', parsedProps.error.format());
  }
  const entityData = parsedProps.success
    ? parsedProps.data
    : { sourceOrg: undefined, assets: [], targetOrg: undefined, transferType: undefined, formType: undefined };

  const { onSelect } = props;

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDTOwithPayloadSchema>();
  const [selectedDate] = useState(new Date().toDateString());
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [showSignatureOverlay, setShowSignatureOverlay] = useState(false);

  const { generatePdf, isLoading: isGenerating, error: generatePdfError, unsignedDocumentData } = useGeneratePdf();
  const { signPdf, isSigning, isSigned, error: signPdfError, resetSigningState } = useSignPdf();

  useEffect(() => {
    setPdfBlobUrl(null);
    setShowSignatureOverlay(false);
    resetSigningState();
  }, [selectedTemplate?.id, resetSigningState]);

  const payloadData = useMemo(() => masterPayloadInputSchema.parse({...entityData, selectedDate}), [entityData, selectedDate]);

  const displayPayload = useMemo(
    () => selectedTemplate?.payloadSchema.parse(payloadData), 
    [entityData, selectedDate, selectedTemplate]
  );

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

  const handleSign = async (signatureDataUrl: string) => {
    if (!unsignedDocumentData || !pdfBlobUrl) return;

    await signPdf({
      params: signPdfParamsSchema.parse({
        ...unsignedDocumentData,
        signerId: 'usr_compliance_officer',
        customPath: `compliance/transfers/${unsignedDocumentData.documentType || 'forms'}`,
        signatureDataUrl,
      }),
      onSuccess: (signedPdfUrl: string) => {
        setPdfBlobUrl(signedPdfUrl);
        setShowSignatureOverlay(false);
      },
    });
  };

  const activeError = generatePdfError || signPdfError;

  const handleSelectTemplate = (template: TemplateDTOwithPayloadSchema | undefined) => {
    setSelectedTemplate(template);
    onSelect(template?.transferType ?? undefined);
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="w-72">
          <TemplateSelector
            label="Compliance Form"
            typeFilter={entityData.formType}
            transferTypeFilter={entityData.transferType}
            onSelect={handleSelectTemplate}
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
            isLoading={isGenerating}
            disabled={!isReadyForPdf || Boolean(pdfBlobUrl)}
            onClick={() => generatePdf({ 
              template: {...selectedTemplate!}, 
              payloadData, 
              onSuccess: setPdfBlobUrl 
            })}
          >
            Generate PDF
          </Button>
        </div>
      </div>

      {activeError && (
        <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-2 rounded-lg text-sm">
          {activeError}
        </div>
      )}

      <div className="flex-1 bg-white rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative min-h-[300px]">
        <DocumentViewer
          content={pdfBlobUrl ?? hydratedHtml}
          contentType={pdfBlobUrl ? 'pdf' : 'html'}
          title="Document Workflow"
          className="w-full h-full flex-1 min-h-0"
          isSigningActive={showSignatureOverlay}
        >
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              disabled={!pdfBlobUrl || isSigned || showSignatureOverlay}
              onClick={() => setShowSignatureOverlay(true)}
              className="w-40 shadow"
            >
              {isSigned ? 'Signed' : 'Sign Document'}
            </Button>
          </div>

          {showSignatureOverlay && pdfBlobUrl && (
            <SignatureOverlay
              isSubmitting={isSigning}
              onCancel={() => setShowSignatureOverlay(false)}
              onSign={handleSign}
            />
          )}
        </DocumentViewer>
      </div>
    </div>
  );
}