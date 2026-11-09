// File: services/core/audit-ledger/server/src/registry/overview.test-support.ts
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { sealedTransferSchema, ledgerAuthorizationSchema, ledgerReceiptSchema } from 'audit-shared';
import { transferAssetSnapshotSchema } from '@contracts/topology';

export function overviewRecord() {
  const first = mockFromSchema(transferAssetSnapshotSchema, { id: 'asset-1', name: '<Asset one>', serialNumber: 'SN-1' });
  const second = mockFromSchema(transferAssetSnapshotSchema, { id: 'asset-2', name: 'Asset two', serialNumber: 'SN-2' });
  const authorization = mockFromSchema(ledgerAuthorizationSchema, { assetIds: [first.id, second.id] });
  const receipt1 = mockFromSchema(ledgerReceiptSchema, { assetIds: [first.id], receivedAssets: [first] });
  const receipt2 = mockFromSchema(ledgerReceiptSchema, { assetIds: [second.id], receivedAssets: [second] });
  return sealedTransferSchema.parse({
    ...mockFromSchema(sealedTransferSchema, { assets: [first, second], authorization, receipts: [receipt1, receipt2] }),
    sequence: 1, recordHash: SHA256_HEX, requisitionNumber: 'REQ-001',
  });
}
