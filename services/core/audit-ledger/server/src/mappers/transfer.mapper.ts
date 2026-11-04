// File: services/core/audit-ledger/server/src/mappers/transfer.mapper.ts
import {
  LEDGER_STATUS,
  sealedTransferSchema,
  transferSummarySchema,
  type SealedTransfer,
  type TransferSummary,
} from 'audit-shared';
import { getMissingSignals, type TransferDraftEntity } from '../domain';
import { computeRecordHash } from '../utils';

export function draftToSummary(draft: TransferDraftEntity): TransferSummary {
  return transferSummarySchema.parse({
    requisitionNumber: draft.requisitionNumber,
    status: LEDGER_STATUS.OPEN,
    transferType: draft.transferType,
    date: draft.date,
    missingSignals: getMissingSignals(draft),
    updatedAt: draft.updatedAt,
  });
}

export function sealedToSummary(record: SealedTransfer): TransferSummary {
  return transferSummarySchema.parse({
    requisitionNumber: record.requisitionNumber,
    status: LEDGER_STATUS.SEALED,
    transferType: record.transferType,
    date: record.date,
    sequence: record.sequence,
    sealedAt: record.sealedAt,
    recordHash: record.recordHash,
    missingSignals: [],
    updatedAt: record.sealedAt,
  });
}

/** Builds the hash-chained record from a complete draft. The caller guarantees no signals are missing. */
export function draftToSealedTransfer(
  draft: TransferDraftEntity,
  chain: { sequence: number; prevHash: string; sealedAt: string }
): SealedTransfer {
  const receipts = Object.values(draft.receiptDocuments)
    .map((doc) => ({ ...doc, receivedAssets: draft.receivedAssets[doc.documentId] ?? [] }))
    .sort((a, b) => a.signedAt.localeCompare(b.signedAt) || a.documentId.localeCompare(b.documentId));

  const body = {
    sequence: chain.sequence,
    requisitionNumber: draft.requisitionNumber,
    transferEventId: draft.transferEventId,
    transferType: draft.transferType,
    date: draft.date,
    sender: draft.sender,
    receiver: draft.receiver,
    assets: draft.assets,
    authorization: draft.authorization,
    receipts,
    completedAt: draft.completedAt,
    eventIds: [...draft.eventIds].sort((a, b) => a.localeCompare(b)),
    sealedAt: chain.sealedAt,
    prevHash: chain.prevHash,
  };
  const parsed = sealedTransferSchema.omit({ recordHash: true }).parse(body);
  return { ...parsed, recordHash: computeRecordHash(parsed) };
}
