// File: services/platform/compliance/client/src/hooks/useSignPdf.ts
import { useCallback, useState } from 'react';
import { signDocument } from 'esign-client';

export interface SignPdfParams {
  pdfBlobUrl: string;
  documentId: string;
  signerId: string;
  entityId: string;
  customPath?: string;
  documentType?: string;
}

export function useSignPdf() {
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signPdf = useCallback(async (
    params: SignPdfParams,
    signatureDataUrl: string,
    onSuccess: (signedBlobUrl: string) => void
  ) => {
    if (!params.pdfBlobUrl) {
      setError('No PDF blob available to sign.');
      return;
    }

    try {
      setIsSigning(true);
      setError(null);

      const signedPdfUrl = await signDocument({
        pdfBlobUrl: params.pdfBlobUrl,
        signatureDataUrl,
        documentId: params.documentId,
        signerId: params.signerId,
        entityId: params.entityId,
        customPath: params.customPath,
        documentType: params.documentType,
      });

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