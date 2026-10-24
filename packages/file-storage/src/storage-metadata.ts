// File: packages/file-store/src/storage-metadata.ts
import type { z } from 'zod';
import { getStorageMetadataParamsSchema } from '@contracts/common';
import { getStorageMetadataReturnSchema } from './types';

export { getStorageMetadataParamsSchema } from '@contracts/common';

type GetStorageMetadataParams = z.infer<typeof getStorageMetadataParamsSchema>;
type GetStorageMetadataReturn = z.infer<typeof getStorageMetadataReturnSchema>

export function getStorageMetadata({
  customPath, documentName, documentId, documentType, requisitionNumber, jobId, signedAt, signerId
}: GetStorageMetadataParams): GetStorageMetadataReturn {
  const sanitizedPath = customPath ? customPath.replace(/^\/+|\/+$/g, '') : '';
  const storageKey = sanitizedPath
    ? `${sanitizedPath}/${documentId}.pdf`
    : `${documentId}.pdf`;

  const storageBucket = process.env.DOCUMENT_BUCKET || 'dsap';  

  const metadata: Record<string, string> = {
    'document-name': documentName,
    'document-type': documentType,
    'requisition-number': requisitionNumber,
  };

  if(signerId) {
    metadata['signer-id'] = signerId;
  }
  
  if (jobId) {
    metadata['job-id'] = jobId;
  }

  if (signedAt) {
    metadata['signed-at'] = signedAt;
  }
  return {storageBucket, storageKey, metadata};
}