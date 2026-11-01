// File: services/core/compliance-service/client/src/hooks/useGeneratePdf.ts
import { useCallback, useState } from 'react';
import { apiClient } from '../../api';
import { signDocumentApiRequestSchema, templateDTOSchema, masterPayloadInputSchema } from 'compliance-shared';
import { z } from 'zod';

const generatePdfParamsSchema = z.object({
  template: templateDTOSchema.pick({ id: true }).passthrough(),
  payloadData: masterPayloadInputSchema,
})
type GeneratePdfParamsSchema = z.infer<typeof generatePdfParamsSchema> & {readonly onSuccess: (blobUrl: string) => void}

const unsignedDocumentDataSchema = signDocumentApiRequestSchema.omit({signatureImageBase64: true, customPath: true, signerId: true});
type UnsignedDocumentData = z.infer<typeof unsignedDocumentDataSchema>;

export function useGeneratePdf() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsignedDocumentData, setUnsignedDocumentData] = useState<UnsignedDocumentData | null>(null);

  const generatePdf = useCallback(async ({template, payloadData, onSuccess}: GeneratePdfParamsSchema) => {
    if (!template.id || !payloadData.sourceOrg) return;

    try {
      setIsGenerating(true);
      setError(null);

      // Hit the backend draft endpoint returning JSON containing the pre-signed URL
      const response = await apiClient.createTemplateDraft({
        params: { id: template.id },
        body: { data: payloadData },
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
          ...payloadData, 
          ...response.body,
          senderOrgId :payloadData.sourceOrg.id, 
          receiverOrgId: payloadData.targetOrg?.id, 
          assetIds: payloadData.assets?.map(a => a.id),
          transferEventId: payloadData.transferEventId,
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