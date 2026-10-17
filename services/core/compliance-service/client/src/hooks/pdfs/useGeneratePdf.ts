// File: services/core/compliance-service/client/src/hooks/useGeneratePdf.ts
import { useCallback, useState } from 'react';
import { apiClient } from '../../api/client';
import { generateTemplatePayload, PayloadParams } from '../../registry';

let sequenceCounter = 1;

export function useGeneratePdf() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePdf = useCallback(async (payloadParams: PayloadParams, onSuccess: (blobUrl: string) => void) => {
    if (!payloadParams.templateId) return;

    try {
      setIsGenerating(true);
      setError(null);

      const requisitionNumber = `REQ-2026-${String(sequenceCounter++).padStart(4, '0')}`;
      
      const executionParams: PayloadParams = {
        ...payloadParams,
        input: {
          ...payloadParams.input,
          requisitionNumber,
        },
        usePlaceholders: false,
      };

      const productionPayload = generateTemplatePayload(executionParams);

      // Hit the backend draft endpoint returning JSON containing the pre-signed URL
      const response = await apiClient.createTemplateDraft({
        params: { id: payloadParams.templateId },
        body: productionPayload,
      });

      if (response.status === 201) {
        // Fetch the PDF binary directly from MinIO using the pre-signed URL
        const pdfRes = await fetch(response.body.presignedUrl);
        if (!pdfRes.ok) {
          throw new Error(`Failed to download PDF from storage (HTTP ${pdfRes.status})`);
        }

        const contentType = pdfRes.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
        if (contentType !== 'application/pdf') {
          throw new Error(
            `Expected a PDF from storage but received ${contentType || 'an unknown content type'}`
          );
        }

        const blob = await pdfRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        onSuccess(blobUrl);
      } else {
        const errBody = response.body as { error?: string; message?: string };
        setError(errBody?.error || errBody?.message || 'Failed to generate PDF draft');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF draft');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generatePdf,
    isLoading: isGenerating,
    error,
  };
}