// File: services/core/compliance-service/server/src/repositories/documents/draft-binding.ts
import { z } from 'zod';
import { signDocumentApiRequestSchema } from 'compliance-shared';

export const draftBindingSchema = signDocumentApiRequestSchema.pick({
  documentId: true,
  documentName: true,
  documentType: true,
  transferType: true,
  requisitionNumber: true,
  storageBucket: true,
  storageKey: true,
  fileHash: true,
  jobId: true,
  senderOrgId: true,
  receiverOrgId: true,
  assetIds: true,
  transferEventId: true,
}).extend({ fileHash: z.string().regex(/^[0-9a-f]{64}$/) });

export type DraftBinding = z.infer<typeof draftBindingSchema>;

export function draftBindingMatches(expected: DraftBinding, actual: DraftBinding): boolean {
  const left = draftBindingSchema.parse(expected);
  const right = draftBindingSchema.parse(actual);
  return left.documentId === right.documentId
    && left.documentName === right.documentName
    && left.documentType === right.documentType
    && left.transferType === right.transferType
    && left.requisitionNumber === right.requisitionNumber
    && left.storageBucket === right.storageBucket
    && left.storageKey === right.storageKey
    && left.fileHash === right.fileHash
    && left.jobId === right.jobId
    && left.senderOrgId === right.senderOrgId
    && left.receiverOrgId === right.receiverOrgId
    && left.transferEventId === right.transferEventId
    && left.assetIds.length === right.assetIds.length
    && left.assetIds.every((asset, index) => asset === right.assetIds[index]);
}
