// File: services/platform/compliance/client/src/hooks/pdfs/useSignPdf.ts
import { useCallback, useState } from 'react';
import { apiClient } from '../../api';
import { signDocumentApiRequestSchema } from 'compliance-shared';
import { z } from 'zod';

export const signPdfParamsSchema = signDocumentApiRequestSchema.omit({signatureImageBase64: true}).extend({
  signatureDataUrl: z.string(),
});

type SignPdfParams = {
  params: z.infer<typeof signPdfParamsSchema>
  readonly onSuccess: (signedBlobUrl: string) => void
}

export function useSignPdf() {
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signPdf = useCallback(async ({params, onSuccess}: SignPdfParams) => {

    try {
      setIsSigning(true);
      setError(null);

      const signatureImageBase64 = params.signatureDataUrl.includes(',')
        ? params.signatureDataUrl.split(',')[1]
        : params.signatureDataUrl;
        
      const response = await apiClient.signDocument({
        body: signDocumentApiRequestSchema.parse({...params, signatureImageBase64}),
      });

      if (response.status !== 200) {
        const errBody = response.body as { error?: string };
        throw new Error(errBody?.error || `Failed to sign document: HTTP ${response.status}`);
      }

      // Fetch the newly signed PDF binary directly from Minio using the returned pre-signed URL
      const responseBody = response.body as { presignedUrl?: string };
      if (!responseBody.presignedUrl) {
        throw new Error('No pre-signed URL returned for signed document.');
      }

      const pdfRes = await fetch(responseBody.presignedUrl);
      if (!pdfRes.ok) {
        throw new Error(`Failed to download signed PDF from storage (HTTP ${pdfRes.status})`);
      }

      const blob = await pdfRes.blob();
      const signedPdfUrl = URL.createObjectURL(blob);

      setIsSigned(true);
      onSuccess(signedPdfUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign document.';
      setError(msg);
      throw err;
    } finally {
      setIsSigning(false);
    }
  }, []);

  const resetSigningState = useCallback(() => {
    setIsSigning(false);
    setIsSigned(false);
    setError(null);
  }, []);

  return {
    signPdf,
    isSigning,
    isSigned,
    error,
    resetSigningState,
  };
}