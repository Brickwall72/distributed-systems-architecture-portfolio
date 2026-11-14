// File: packages/contracts/topology/src/transfer-requests.schema.ts
import { z } from 'zod';
import { createCloudEventSchema } from '@contracts/common';
import { transferDraftFactsSchema } from './transfer-claim.schema';

export const TOPOLOGY_REQUEST_SUBJECTS = {
  VALIDATE_DRAFT: 'requests.topology.transfer.validate-draft',
  RESERVE: 'requests.topology.transfer.reserve',
} as const;

export const TOPOLOGY_SIGNED_EVENT_SUBJECT = 'events.compliance.transfer.signed';
export const TOPOLOGY_SIGNED_EVENT_TYPE = 'com.system.compliance.transfer.signed';

export const signedTransferEventSchema = createCloudEventSchema(z.object({
  documentId: z.string().uuid(),
  transferEventId: z.string().uuid(),
  draftHash: z.string().regex(/^[0-9a-f]{64}$/),
  signedFileHash: z.string().regex(/^[0-9a-f]{64}$/),
}));

const requestFailureSchema = z.object({
  status: z.enum(['CONFLICT', 'INVALID', 'UNAVAILABLE']),
  message: z.string().min(1),
});

export const validateDraftResponseSchema = z.union([
  z.object({ status: z.literal('OK'), facts: transferDraftFactsSchema }),
  requestFailureSchema,
]);

export const reserveTransferResponseSchema = z.union([
  z.object({ status: z.literal('OK'), transferEventId: z.string().uuid() }),
  requestFailureSchema,
]);

export type ValidateDraftResponse = z.infer<typeof validateDraftResponseSchema>;
export type ReserveTransferResponse = z.infer<typeof reserveTransferResponseSchema>;
