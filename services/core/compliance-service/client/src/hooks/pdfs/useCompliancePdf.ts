// File: services/core/compliance-service/client/src/hooks/useCompliancePdf.ts
import { useCallback, useState } from 'react';
import { apiClient } from '../../api/client';
import { generateTemplatePayload, PayloadParams } from '../../registry';

let sequenceCounter = 1;

export function useCompliancePdf() {
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

      // Hit the backend draft endpoint returning JSON containing base64 PDF
      const response = await apiClient.createTemplateDraft({
        params: { id: payloadParams.templateId },
        body: productionPayload,
      });

      if (response.status === 201) {
        // Convert base64 string back to a binary Blob
        const binaryString = atob(response.body.pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.codePointAt(i)!;
        }
        
        const blob = new Blob([bytes], { type: 'application/pdf' });
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