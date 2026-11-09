// File: services/core/audit-ledger/shared/src/schemas/DTO/sealed-transfer.dto.schema.ts
import { z } from 'zod';
import { transferTypeEnum } from '@contracts/common';
import { transferInitiatedDataSchema, transferReceivedDataSchema } from '@contracts/compliance';
import {
  transferAssetSnapshotSchema,
  transferEventCreatedDataSchema,
  transferOrganizationSnapshotSchema,
} from '@contracts/topology';

/** Facts that must all be present before a transfer record is sealed. */
export const SEAL_SIGNAL = {
  TOPOLOGY_COMPLETED: 'TOPOLOGY_COMPLETED',
  AUTHORIZATION_DOCUMENT: 'AUTHORIZATION_DOCUMENT',
  RECEIPT_DOCUMENTS: 'RECEIPT_DOCUMENTS',
} as const;
export const sealSignalEnum = z.enum(
  Object.values(SEAL_SIGNAL) as [typeof SEAL_SIGNAL[keyof typeof SEAL_SIGNAL], ...typeof SEAL_SIGNAL[keyof typeof SEAL_SIGNAL][]]
);
export type SealSignal = z.infer<typeof sealSignalEnum>;

export const LEDGER_STATUS = {
  OPEN: 'OPEN',
  SEALED: 'SEALED',
} as const;
export const ledgerStatusEnum = z.enum(
  Object.values(LEDGER_STATUS) as [typeof LEDGER_STATUS[keyof typeof LEDGER_STATUS], ...typeof LEDGER_STATUS[keyof typeof LEDGER_STATUS][]]
);
export type LedgerStatus = z.infer<typeof ledgerStatusEnum>;

/** The authorization document, exactly as compliance published it when the transfer was initiated. */
export const ledgerAuthorizationSchema = transferInitiatedDataSchema.omit({ requisitionNumber: true });
export type LedgerAuthorization = z.infer<typeof ledgerAuthorizationSchema>;

/** One receipt document plus the asset snapshots topology reported for it. A transfer may have many. */
export const ledgerReceiptSchema = transferReceivedDataSchema
  .omit({ requisitionNumber: true, transferEventId: true })
  .extend({ receivedAssets: z.array(transferAssetSnapshotSchema) });
export type LedgerReceipt = z.infer<typeof ledgerReceiptSchema>;

/** Hash-chained body of a sealed record; recordHash covers every other field. */
export const sealedTransferSchema = z.object({
  sequence: z.number().int().positive(),
  requisitionNumber: transferEventCreatedDataSchema.shape.requisitionNumber,
  transferEventId: transferEventCreatedDataSchema.shape.transferEventId,
  transferType: transferTypeEnum,
  date: z.string().datetime(),
  sender: transferOrganizationSnapshotSchema,
  receiver: transferOrganizationSnapshotSchema,
  assets: z.array(transferAssetSnapshotSchema),
  authorization: ledgerAuthorizationSchema,
  receipts: z.array(ledgerReceiptSchema),
  completedAt: z.string().datetime(),
  eventIds: z.array(z.string()),
  sealedAt: z.string().datetime(),
  prevHash: z.string().length(64),
  recordHash: z.string().length(64),
});
export type SealedTransfer = z.infer<typeof sealedTransferSchema>;

export const RENDITION_STATUS = {
  PENDING: 'PENDING',
  GENERATING: 'GENERATING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export const renditionStatusEnum = z.enum(
  Object.values(RENDITION_STATUS) as [typeof RENDITION_STATUS[keyof typeof RENDITION_STATUS], ...typeof RENDITION_STATUS[keyof typeof RENDITION_STATUS][]]
);
export const transferSummarySchema = z.object({
  requisitionNumber: z.string(),
  status: ledgerStatusEnum,
  transferType: transferTypeEnum.optional(),
  date: z.string().datetime().optional(),
  sequence: sealedTransferSchema.shape.sequence.optional(),
  sealedAt: sealedTransferSchema.shape.sealedAt.optional(),
  recordHash: sealedTransferSchema.shape.recordHash.optional(),
  renditionStatus: renditionStatusEnum.optional(),
  missingSignals: z.array(sealSignalEnum),
  updatedAt: z.string().datetime(),
});
export type TransferSummary = z.infer<typeof transferSummarySchema>;

export const GetTransfersQuerySchema = z.object({
  status: ledgerStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GetTransfersQuery = z.input<typeof GetTransfersQuerySchema>;

export const VERIFICATION_FAILURE = {
  HASH_MISMATCH: 'HASH_MISMATCH',
  CHAIN_BROKEN: 'CHAIN_BROKEN',
  SEQUENCE_GAP: 'SEQUENCE_GAP',
} as const;
export const verificationFailureEnum = z.enum(
  Object.values(VERIFICATION_FAILURE) as [typeof VERIFICATION_FAILURE[keyof typeof VERIFICATION_FAILURE], ...typeof VERIFICATION_FAILURE[keyof typeof VERIFICATION_FAILURE][]]
);

export const verificationResultSchema = z.object({
  valid: z.boolean(),
  checked: z.number().int().min(0),
  failures: z.array(z.object({
    sequence: sealedTransferSchema.shape.sequence,
    requisitionNumber: sealedTransferSchema.shape.requisitionNumber,
    reason: verificationFailureEnum,
  })),
});
export type VerificationResult = z.infer<typeof verificationResultSchema>;

export const DEAD_LETTER_REASON = {
  MALFORMED: 'MALFORMED',
  LATE_EVENT: 'LATE_EVENT',
} as const;
export const deadLetterReasonEnum = z.enum(
  Object.values(DEAD_LETTER_REASON) as [typeof DEAD_LETTER_REASON[keyof typeof DEAD_LETTER_REASON], ...typeof DEAD_LETTER_REASON[keyof typeof DEAD_LETTER_REASON][]]
);
export type DeadLetterReason = z.infer<typeof deadLetterReasonEnum>;

/** Events the ledger could not apply, held for human review instead of being retried or dropped. */
export const deadLetterSchema = z.object({
  reason: deadLetterReasonEnum,
  subject: z.string(),
  eventId: z.string().optional(),
  requisitionNumber: z.string().optional(),
  detail: z.string(),
  payload: z.unknown(),
  receivedAt: z.string().datetime(),
});
export type DeadLetter = z.infer<typeof deadLetterSchema>;
