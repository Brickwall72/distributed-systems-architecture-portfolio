// File: services/core/compliance-service/client/src/widgets/ComplianceWorkflow/ComplianceWorkflow.tsx
import { useState, useMemo, useEffect, useRef } from 'react';
import { Button, DocumentViewer, useIdentity } from '@shared/ui-components';
import { isAuditor, type Identity } from '@contracts/auth';
import { hydrateTemplate } from '@shared/utils';
import { SignatureOverlay } from 'esign-client';
import { ComplianceWorkflowWidgetPropsSchema, type ComplianceWorkflowWidgetProps } from '@contracts/compliance'; 
import { masterPayloadInputSchema, templateId2dataSchema, getReceiptTemplateId } from 'compliance-shared';
import { useDocumentSync, useGeneratePdf, useSignPdf, signPdfParamsSchema, useTemplateQuery } from '../../hooks';
import '@shared/styles';

export default function ComplianceWorkflowWidget(props: Readonly<ComplianceWorkflowWidgetProps>) {
  const identity = useIdentity();
  const sessionKey = JSON.stringify([
    identity?.id, identity?.orgId, identity?.roles,
    props.sourceOrg, props.targetOrg, props.assets, props.requisitionNumber,
    props.transferEventId, props.authorizingTemplateId, props.template?.id, props.template?.rawHTML,
  ]);
  return <ComplianceWorkflowSession key={sessionKey} identity={identity} {...props} />;
}

function ComplianceWorkflowSession({ identity, ...props }: Readonly<ComplianceWorkflowWidgetProps> & { identity: Identity | null }) {
  const parsedProps = ComplianceWorkflowWidgetPropsSchema.safeParse(props);
  if (!parsedProps.success) {
    console.warn('[ComplianceWorkflowWidget MFE] Invalid props received from Host Shell:', parsedProps.error.format());
  }
  const entityData = parsedProps.success
    ? parsedProps.data
    : { sourceOrg: undefined, assets: [], targetOrg: undefined, template: undefined, requisitionNumber: undefined, authorizingTemplateId: undefined };

  // When receiving against an existing authorization, the receipt template is derived from the authorizing template
  const receiptTemplateId = entityData.requisitionNumber
    ? getReceiptTemplateId(entityData.authorizingTemplateId)
    : undefined;
  const { data: receiptTemplate } = useTemplateQuery(receiptTemplateId);

  const selectedTemplate = useMemo(() => {
    if (!receiptTemplateId) return entityData.template;
    const pipeline = (templateId2dataSchema as Record<string, unknown>)[receiptTemplateId];
    if (!receiptTemplate || !pipeline) return undefined;
    return { ...receiptTemplate, payloadSchema: pipeline } as NonNullable<typeof entityData.template>;
  }, [receiptTemplateId, receiptTemplate, entityData.template]);

  const [selectedDate] = useState(new Date().toDateString());
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [showSignatureOverlay, setShowSignatureOverlay] = useState(false);
  const [signedDocumentId, setSignedDocumentId] = useState<string>();
  const generation = useRef(0);

  const { generatePdf, isLoading: isGenerating, error: generatePdfError, unsignedDocumentData } = useGeneratePdf();
  const { signPdf, isSigning, isSigned, error: signPdfError, resetSigningState } = useSignPdf();
  const synchronization = useDocumentSync(signedDocumentId);

  useEffect(() => {
    generation.current += 1;
    setPdfBlobUrl(null);
    setShowSignatureOverlay(false);
    setSignedDocumentId(undefined);
    resetSigningState();
    return () => { generation.current += 1; };
  }, [selectedTemplate?.id, resetSigningState]);

  useEffect(() => () => {
    if (pdfBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfBlobUrl);
  }, [pdfBlobUrl]);

  const canWrite = Boolean(identity?.orgId && !isAuditor(identity));
  const acceptPdf = (url: string, requestGeneration: number) => {
    if (generation.current !== requestGeneration) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      return;
    }
    setPdfBlobUrl(url);
  };
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
    if (!unsignedDocumentData || !pdfBlobUrl || !identity || !canWrite) return;

    const requestGeneration = generation.current;
    await signPdf({
      params: signPdfParamsSchema.parse({
        ...unsignedDocumentData,
        signerId: identity.signerId,
        customPath: `compliance/transfers/${unsignedDocumentData.documentType || 'forms'}`,
        signatureDataUrl,
      }),
      onSuccess: (signedPdfUrl: string) => {
        acceptPdf(signedPdfUrl, requestGeneration);
        if (generation.current === requestGeneration) {
          setShowSignatureOverlay(false);
          setSignedDocumentId(unsignedDocumentData.documentId);
        }
      },
    });
  };

  const activeError = generatePdfError || signPdfError;
  const topologyApplicationStatus = (
    synchronization.data as { topologyApplicationStatus?: string } | undefined
  )?.topologyApplicationStatus;
  let synchronizationMessage = 'Signed document saved; topology update pending.';
  if (synchronization.error) {
    synchronizationMessage = 'Signed document saved, but synchronization status could not be checked.';
  } else if (topologyApplicationStatus === 'APPLIED') {
    synchronizationMessage = 'Signed document saved; topology update applied.';
  } else if (topologyApplicationStatus === 'ATTENTION_REQUIRED') {
    synchronizationMessage = 'Signed document saved; synchronization needs operator attention.';
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-4">
      {activeError && (
        <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-2 rounded-lg text-sm">
          {activeError}
        </div>
      )}
      {signedDocumentId && (
        <output className="border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200">
          {synchronizationMessage}
        </output>
      )}

      <div className="flex-1 bg-white rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative min-h-[300px]">
        <DocumentViewer
          content={pdfBlobUrl ?? hydratedHtml}
          contentType={pdfBlobUrl ? 'pdf' : 'html'}
          title="Document Workflow"
          className="w-full h-full flex-1 min-h-0"
          isSigningActive={showSignatureOverlay}
        >
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3">
            {pdfBlobUrl ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setPdfBlobUrl(null)}
                  className="shadow"
                >
                  Back to Interactive View
                </Button>
                <Button
                  disabled={!canWrite || isSigned || showSignatureOverlay}
                  onClick={() => setShowSignatureOverlay(true)}
                  className="w-40 shadow"
                >
                  {isSigned ? 'Signed' : 'Sign Document'}
                </Button>
              </>
            ) : (
              <Button
                isLoading={isGenerating}
                disabled={!canWrite || !isReadyForPdf}
                onClick={() => {
                  if (!canWrite) return;
                  const requestGeneration = generation.current;
                  void generatePdf({
                    template: {...selectedTemplate!},
                    payloadData,
                    onSuccess: (url) => acceptPdf(url, requestGeneration),
                  });
                }}
                className="w-40 shadow"
              >
                Generate PDF
              </Button>
            )}
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