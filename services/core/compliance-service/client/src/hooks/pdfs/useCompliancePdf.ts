// File: services/core/compliance-service/client/src/hooks/useCompliancePdf.ts
import { useCallback } from 'react';
import { usePdfGenerator } from 'pdf-client';
import { hydrateTemplate } from '@shared/ui-components';
import { generateTemplatePayload, PayloadParams } from '../../registry';
import { useTemplateQuery } from '../templates';

let sequenceCounter = 1;

export function useCompliancePdf(payloadParams: PayloadParams) {
  // 1. Fetch template following your established query pattern
  const { data: templateData, isLoading: isTemplateLoading, error: templateError } = useTemplateQuery(payloadParams.templateId);
  const rawHTML = templateData?.rawHTML;

  // 2. Generate sequential requisition number and file name
  const requisitionNumber = `REQ-2026-${String(sequenceCounter++).padStart(4, '0')}`;
  const fileName = `${payloadParams.templateId || 'document'}-${requisitionNumber}.pdf`;

  // 3. Setup pdf-client hook
  const { generate: generatePdfBlob, isGenerating: isPdfGenerating, error: pdfError } = usePdfGenerator({
    fileName,
    onSuccess:()=>console.log('PDF generation successful')
  });

  // 4. Action callback that the widget invokes on button click
  const generatePdf = useCallback(async (onSuccess: (blobUrl: string) => void) => {
    if (!payloadParams.templateId || !rawHTML) return;

    payloadParams.input.requisitionNumber = requisitionNumber;
    payloadParams.usePlaceholders = false;

    const productionPayload = generateTemplatePayload(payloadParams);
    const hydratedHtml = hydrateTemplate(rawHTML, productionPayload);

    const blobUrl = await generatePdfBlob(hydratedHtml);
    if (blobUrl) {
      onSuccess(blobUrl);
    }
  }, [payloadParams, rawHTML, requisitionNumber, generatePdfBlob]);

  return {
    generatePdf,
    isLoading: isTemplateLoading || isPdfGenerating,
    error: templateError || pdfError?.message || null,
  };
}