// File: services/core/compliance-service/client/src/hooks/useGeneratePdf.ts
import { useCallback, useState } from 'react';
import { apiClient } from '../../api';
import { generateTemplatePayload, PayloadParams } from '../../registry';
import { signDocumentApiRequestSchema } from 'compliance-shared';
import { z } from 'zod';

const unsignedDocumentDataSchema = signDocumentApiRequestSchema.omit({signatureImageBase64: true, customPath: true, signerId: true});
type UnsignedDocumentData = z.infer<typeof unsignedDocumentDataSchema>;

export function useGeneratePdf() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsignedDocumentData, setUnsignedDocumentData] = useState<UnsignedDocumentData | null>(null);

  const generatePdf = useCallback(async (payloadParams: PayloadParams, onSuccess: (blobUrl: string) => void) => {
    if (!payloadParams.templateId || !payloadParams.input.sourceOrg) return;

    try {
      setIsGenerating(true);
      setError(null);
      
      const executionParams: PayloadParams = {
        ...payloadParams,
        usePlaceholders: false,
      };

      const productionPayload = generateTemplatePayload(executionParams);

      // Hit the backend draft endpoint returning JSON containing the pre-signed URL
      const response = await apiClient.createTemplateDraft({
        params: { id: payloadParams.templateId },
        body: {data: productionPayload},
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
        setUnsignedDocumentData(unsignedDocumentDataSchema.parse({
          ...payloadParams.input, 
          ...response.body,
          senderOrgId :payloadParams.input.sourceOrg.id, 
          receiverOrgId: payloadParams.input.targetOrg?.id, 
          assetIds: payloadParams.input.assets?.map(a => a.id),
        }));
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
    unsignedDocumentData,
  };
}