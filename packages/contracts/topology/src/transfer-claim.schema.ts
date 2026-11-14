// File: packages/contracts/topology/src/transfer-claim.schema.ts
import { z } from 'zod';
import { transferTypeEnum } from '@contracts/common';
import { transferAssetSnapshotSchema, transferOrganizationSnapshotSchema } from './messaging';

export const transferDraftValidationSchema = z.object({
  senderOrgId: z.string().min(1),
  receiverOrgId: z.string().min(1),
  requisitionNumber: z.string().min(1).max(100),
  transferType: transferTypeEnum,
  operation: z.enum(['AUTHORIZATION', 'RECEIPT']),
  transferEventId: z.string().uuid().optional(),
  assetIds: z.array(z.string().min(1)).min(1),
}).superRefine((request, ctx) => {
  if (new Set(request.assetIds).size !== request.assetIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assetIds'], message: 'Duplicate assets are not permitted' });
  }
  if (request.senderOrgId === request.receiverOrgId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['receiverOrgId'], message: 'Sender and receiver must be distinct' });
  }
  if ((request.operation === 'AUTHORIZATION' && request.transferEventId)
    || (request.operation === 'RECEIPT' && !request.transferEventId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transferEventId'], message: 'Transfer ID does not match the operation' });
  }
});

export const transferDraftFactsSchema = z.object({
  sender: transferOrganizationSnapshotSchema,
  receiver: transferOrganizationSnapshotSchema,
  assets: z.array(transferAssetSnapshotSchema).min(1),
});

export type TransferDraftValidation = z.infer<typeof transferDraftValidationSchema>;
export type TransferDraftFacts = z.infer<typeof transferDraftFactsSchema>;

export const transferClaimSchema = z.object({
  documentId: z.string().uuid(),
  draftHash: z.string().regex(/^[0-9a-f]{64}$/),
  creatorId: z.string().min(1),
  templateId: z.string().min(1),
  storageBucket: z.string().min(1).max(100),
  storageKey: z.string().min(1),
  signerOrgId: z.string().min(1),
  senderOrgId: z.string().min(1),
  receiverOrgId: z.string().min(1),
  requisitionNumber: z.string().min(1).max(100),
  transferType: transferTypeEnum,
  operation: z.enum(['AUTHORIZATION', 'RECEIPT']),
  transferEventId: z.string().uuid().optional(),
  assetIds: z.array(z.string().min(1)).min(1),
}).superRefine((claim, ctx) => {
  if (new Set(claim.assetIds).size !== claim.assetIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assetIds'], message: 'Duplicate assets are not permitted' });
  }
  if (claim.senderOrgId === claim.receiverOrgId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['receiverOrgId'], message: 'Sender and receiver must be distinct' });
  }
  if (claim.operation === 'AUTHORIZATION' && (claim.transferEventId || claim.signerOrgId !== claim.senderOrgId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Authorization requires the sender and no transfer ID' });
  }
  if (claim.operation === 'RECEIPT' && (!claim.transferEventId || claim.signerOrgId !== claim.receiverOrgId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Receipt requires the receiver and a transfer ID' });
  }
});

export type TransferClaim = z.infer<typeof transferClaimSchema>;
