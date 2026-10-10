// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow.tsx
import { useState, useMemo } from 'react';
import { Button, DocumentViewer, hydrateTemplate } from '@shared/ui-components';
import { SignatureOverlay } from 'esign-client';
import { usePdfGenerator } from 'pdf-client';
import { ComplianceWorkflowWidgetPropsSchema, type ComplianceWorkflowWidgetProps } from '@contracts/compliance';
import { TemplateSelector } from '../../components'; 
import { TemplateDTO } from 'compliance-shared';
import '@shared/styles';

export default function ComplianceWorkflowWidget(props: Readonly<ComplianceWorkflowWidgetProps>) {
  const parsedProps = ComplianceWorkflowWidgetPropsSchema.safeParse(props);
  if (!parsedProps.success) {
    console.warn('[ComplianceWorkflowWidget MFE] Invalid props received from Host Shell:', parsedProps.error.format());
  }
  const { sourceOrg, assets, targetOrg } = parsedProps.success
    ? parsedProps.data
    : { sourceOrg: undefined, assets: [], targetOrg: undefined };

  const requisitionNumber = 'REQ-2026-001';
  const signerId = 'usr_compliance_officer';
  const entityId = 'org_unassigned';
  const [documentId] = useState(() => crypto.randomUUID());
  const onWorkflowComplete = (signedPdfUrl: string) => console.log('Final Signed Document:', signedPdfUrl);

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

  const handleTemplateLoad = (template: TemplateDTO) => {
    setSelectedTemplateId(template.id);
    setRawTemplateHtml(template.rawHTML);
    setPdfBlobUrl(null);
    setIsSigning(false);
    setIsSigned(false);
  };

  const [transferDate] = useState(new Date().toDateString());

  const templateData = useMemo<Record<string, unknown> | null>(() => {
    const primaryAsset = assets[0];
    
    // Require at least one organization or asset to construct template data
    if (!sourceOrg && !targetOrg && !primaryAsset) return null;

    return {
      sourceOrg,
      targetOrg,
      asset: primaryAsset,
      assets,
      transferDate,
      requisitionNumber,
      // Fallback flatteners for legacy templates
      releasingEntityName: sourceOrg?.name ?? '',
      receivingEntityName: targetOrg?.name ?? '',
      nomenclature: primaryAsset?.nomenclature ?? primaryAsset?.name ?? '',
      serialNumber: primaryAsset?.serialNumber ?? '',
      items: assets.map((item, idx) => ({
        itemNumber: idx + 1,
        nomenclature: item.nomenclature ?? item.name,
        serialNumber: item.serialNumber ?? '',
        quantity: 1,
        unit: 'EA',
      })),
    };
  }, [sourceOrg, targetOrg, assets, transferDate]);

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