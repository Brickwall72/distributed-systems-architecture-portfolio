// File: services/core/audit-ledger/server/src/domain/seal-signals.ts
import { TRANSFER_TYPE } from '@contracts/common';
import { SEAL_SIGNAL, type SealSignal } from 'audit-shared';
import type { TransferDraftEntity } from './transfer-draft.entity.schema';

/**
 * Signals still missing before the draft may be sealed. Receipt coverage is derived, not declared:
 * physical transfers need receipt documents covering every asset, C2 transfers need none.
 * A future compliance "completed" event would be one more entry here.
 */
export function getMissingSignals(draft: TransferDraftEntity): SealSignal[] {
  const missing: SealSignal[] = [];

  if (!draft.topologyCompleted) missing.push(SEAL_SIGNAL.TOPOLOGY_COMPLETED);
  if (!draft.authorization) missing.push(SEAL_SIGNAL.AUTHORIZATION_DOCUMENT);

  if (draft.transferType === TRANSFER_TYPE.PHYSICAL_TRANSFER) {
    const receipted = new Set(Object.values(draft.receiptDocuments).flatMap((doc) => doc.assetIds));
    const allCovered = (draft.assets ?? []).every((asset) => receipted.has(asset.id));
    if (!allCovered || receipted.size === 0) missing.push(SEAL_SIGNAL.RECEIPT_DOCUMENTS);
  }

  return missing;
}
