// File: services/platform/compliance/client/src/hooks/pdfs/useSignPdf.ts
import { useCallback, useState } from 'react';
import { apiClient } from '../../api';
import { StorageArtifact } from '@contracts/common';

export interface SignPdfParams {
  storageArtifact: StorageArtifact;
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
    if (!params.storageArtifact) {
      setError('No storage artifact available to sign.');
      return;
    }

    try {
      setIsSigning(true);
      setError(null);

      const signatureImageBase64 = signatureDataUrl.includes(',')
        ? signatureDataUrl.split(',')[1]
        : signatureDataUrl;

      const response = await apiClient.signDocument({
        body: {
          storageBucket: params.storageArtifact.storageBucket,
          storageKey: params.storageArtifact.storageKey,
          fileHash: params.storageArtifact.fileHash,
          signatureImageBase64,
          documentId: params.documentId,
          documentType: params.documentType || 'forms',
          signerId: params.signerId,
          entityId: params.entityId,
          customPath: params.customPath,
        },
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