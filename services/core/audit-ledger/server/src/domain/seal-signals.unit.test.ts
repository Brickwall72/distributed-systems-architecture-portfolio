// File: services/core/audit-ledger/server/src/domain/seal-signals.unit.test.ts
import { SEAL_SIGNAL } from 'audit-shared';
import { getMissingSignals } from './seal-signals';
import type { TransferDraftEntity } from './transfer-draft.entity.schema';

const asset = (id: string) => ({ id }) as never;
const doc = (documentId: string, assetIds: string[]) => ({ documentId, assetIds }) as never;
const auth = {} as never;

const draft = (overrides: Partial<TransferDraftEntity>): TransferDraftEntity => ({
  requisitionNumber: 'REQ-1',
  status: 'OPEN',
  receiptDocuments: {},
  receivedAssets: {},
  topologyCompleted: false,
  eventIds: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

describe('getMissingSignals', () => {
  it('requires topology completion and an authorization document', () => {
    expect(getMissingSignals(draft({}))).toEqual([SEAL_SIGNAL.TOPOLOGY_COMPLETED, SEAL_SIGNAL.AUTHORIZATION_DOCUMENT]);
  });

  it('needs no receipts for a C2 transfer', () => {
    expect(
      getMissingSignals(draft({ transferType: 'C2_TRANSFER', topologyCompleted: true, authorization: auth, assets: [asset('a1')] }))
    ).toEqual([]);
  });

  it('requires receipts covering every asset on a physical transfer', () => {
    const base = { transferType: 'PHYSICAL_TRANSFER' as const, topologyCompleted: true, authorization: auth, assets: [asset('a1'), asset('a2')] };
    expect(getMissingSignals(draft(base))).toEqual([SEAL_SIGNAL.RECEIPT_DOCUMENTS]);
    expect(getMissingSignals(draft({ ...base, receiptDocuments: { d1: doc('d1', ['a1']) } }))).toEqual([SEAL_SIGNAL.RECEIPT_DOCUMENTS]);
    expect(
      getMissingSignals(draft({ ...base, receiptDocuments: { d1: doc('d1', ['a1']), d2: doc('d2', ['a2']) } }))
    ).toEqual([]);
  });
});
