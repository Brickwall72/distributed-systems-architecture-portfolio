// File: services/core/audit-ledger/server/src/domain/transfer-draft.entity.schema.ts
import { z } from 'zod';
import { transferTypeEnum } from '@contracts/common';
import { transferAssetSnapshotSchema, transferEventCreatedDataSchema } from '@contracts/topology';
import {
  ledgerAuthorizationSchema,
  ledgerReceiptSchema,
  ledgerStatusEnum,
  LEDGER_STATUS,
} from 'audit-shared';

/** A receipt document before topology's received-asset snapshots are merged in. */
export const receiptDocumentEntitySchema = ledgerReceiptSchema.omit({ receivedAssets: true });
export type ReceiptDocumentEntity = z.infer<typeof receiptDocumentEntitySchema>;

/**
 * Accumulates events for one requisition until every required signal has arrived.
 * Receipts are maps keyed by documentId so compliance and topology events merge in any order.
 */
export const transferDraftEntitySchema = z.object({
  requisitionNumber: transferEventCreatedDataSchema.shape.requisitionNumber,
  status: ledgerStatusEnum.default(LEDGER_STATUS.OPEN),
  transferEventId: transferEventCreatedDataSchema.shape.transferEventId.optional(),
  transferType: transferTypeEnum.optional(),
  date: transferEventCreatedDataSchema.shape.date.optional(),
  sender: transferEventCreatedDataSchema.shape.sender.optional(),
  receiver: transferEventCreatedDataSchema.shape.receiver.optional(),
  assets: z.array(transferAssetSnapshotSchema).optional(),
  authorization: ledgerAuthorizationSchema.optional(),
  receiptDocuments: z.record(receiptDocumentEntitySchema).default({}),
  receivedAssets: z.record(z.array(transferAssetSnapshotSchema)).default({}),
  committedReceiptDocumentIds: z.array(z.string().uuid()).optional(),
  topologyCompleted: z.boolean().default(false),
  completedAt: z.string().datetime().optional(),
  eventIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TransferDraftEntity = z.infer<typeof transferDraftEntitySchema>;

export const eventLogEntitySchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  source: z.string(),
  occurredAt: z.string().datetime(),
  correlationId: z.string().nullable().optional(),
  requisitionNumber: z.string(),
  data: z.unknown(),
  recordedAt: z.string().datetime(),
});
export type EventLogEntity = z.infer<typeof eventLogEntitySchema>;
