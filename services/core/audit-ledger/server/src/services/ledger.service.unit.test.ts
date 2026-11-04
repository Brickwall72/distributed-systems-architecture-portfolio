// File: services/core/audit-ledger/server/src/services/ledger.service.unit.test.ts
import { createInMemoryLedger } from './ledger.test-support';
import { GENESIS_HASH } from '../utils';

const REQ = 'REQ-100';
const TRANSFER_ID = '11111111-1111-4111-8111-111111111111';
const AUTH_DOC = '22222222-2222-4222-8222-222222222222';
const RECEIPT_1 = '33333333-3333-4333-8333-333333333333';
const RECEIPT_2 = '44444444-4444-4444-8444-444444444444';
const HASH = 'a'.repeat(64);
const T = '2025-01-01T00:00:00.000Z';

const org = (id: string) => ({ id, name: `Org ${id}`, type: 'GOV_AGENCY' as never });
const asset = (id: string) => ({
  id, name: `Asset ${id}`, nomenclature: 'N', serialNumber: `SN-${id}`, status: 'IN_TRANSIT' as never,
  type: 'T', controlType: 'LOCAL' as never, currentOwnerId: 'org-a',
});

let seq = 0;
const meta = (eventType: string) => ({ eventId: `evt-${++seq}`, eventType, source: 'test', occurredAt: T });

const topologyBase = (transferType: 'PHYSICAL_TRANSFER' | 'C2_TRANSFER', assetIds: string[]) => ({
  requisitionNumber: REQ, transferEventId: TRANSFER_ID, transferType, date: T,
  sender: org('org-a'), receiver: org('org-b'), assets: assetIds.map(asset),
});
const document = (documentId: string) => ({
  documentId, documentName: `${documentId}.pdf`, documentType: 'DD1149', fileHash: HASH, signerId: 'u1', signedAt: T,
});
const initiated = (assetIds: string[], transferType: 'PHYSICAL_TRANSFER' | 'C2_TRANSFER' = 'PHYSICAL_TRANSFER') => ({
  meta: meta('initiated'),
  data: { ...document(AUTH_DOC), requisitionNumber: REQ, assetIds, date: T, transferType, senderOrgId: 'org-a', receiverOrgId: 'org-b' },
});
const received = (documentId: string, assetIds: string[]) => ({
  meta: meta('received'),
  data: { ...document(documentId), requisitionNumber: REQ, transferEventId: TRANSFER_ID, assetIds },
});
const updated = (documentId: string, assetIds: string[]) => ({
  meta: meta('updated'),
  data: { requisitionNumber: REQ, transferEventId: TRANSFER_ID, transferEventStatus: 'IN_PROGRESS' as never, documentId, receivedAssets: assetIds.map(asset) },
});

describe('LedgerService', () => {
  it('seals a C2 transfer from a lone completed event plus the authorization, with no receipts', async () => {
    const { service, sealed } = createInMemoryLedger();

    await service.handleTransferCompleted({
      meta: meta('completed'),
      data: { ...topologyBase('C2_TRANSFER', ['a1']), transferEventStatus: 'COMPLETED', receivedAssets: [asset('a1')] },
    });
    expect(sealed).toHaveLength(0);

    await service.handleTransferInitiated(initiated(['a1'], 'C2_TRANSFER'));

    expect(sealed).toHaveLength(1);
    expect(sealed[0]).toMatchObject({ sequence: 1, prevHash: GENESIS_HASH, receipts: [], requisitionNumber: REQ });
  });

  it('seals a physical transfer with multiple receipts regardless of arrival order', async () => {
    const { service, sealed } = createInMemoryLedger();

    await service.handleTransferReceived(received(RECEIPT_2, ['a2']));
    await service.handleTransferUpdated(updated(RECEIPT_2, ['a2']));
    await service.handleTransferCompleted({
      meta: meta('completed'),
      data: { ...topologyBase('PHYSICAL_TRANSFER', ['a1', 'a2']), transferEventStatus: 'COMPLETED', documentId: RECEIPT_1, receivedAssets: [asset('a1')] },
    });
    await service.handleTransferReceived(received(RECEIPT_1, ['a1']));
    expect(sealed).toHaveLength(0);

    await service.handleTransferInitiated(initiated(['a1', 'a2']));

    expect(sealed).toHaveLength(1);
    expect(sealed[0].receipts.map((r) => r.documentId).sort()).toEqual([RECEIPT_1, RECEIPT_2]);
    expect(sealed[0].receipts.find((r) => r.documentId === RECEIPT_2)?.receivedAssets).toHaveLength(1);
  });

  it('stays open while receipts do not cover every asset and reports the missing signal', async () => {
    const { service, sealed } = createInMemoryLedger();
    await service.handleTransferInitiated(initiated(['a1', 'a2']));
    await service.handleTransferReceived(received(RECEIPT_1, ['a1']));
    await service.handleTransferCompleted({
      meta: meta('completed'),
      data: { ...topologyBase('PHYSICAL_TRANSFER', ['a1', 'a2']), transferEventStatus: 'COMPLETED', receivedAssets: [] },
    });

    expect(sealed).toHaveLength(0);
    const [summary] = await service.listTransfers({ status: 'OPEN' });
    expect(summary).toMatchObject({ requisitionNumber: REQ, status: 'OPEN', missingSignals: ['RECEIPT_DOCUMENTS'] });
  });

  it('is idempotent when the same event is redelivered', async () => {
    const { service, drafts, eventLog } = createInMemoryLedger();
    const event = initiated(['a1']);

    await service.handleTransferInitiated(event);
    await service.handleTransferInitiated(event);

    expect((drafts.get(REQ)?.eventIds as string[])).toEqual([event.meta.eventId]);
    expect(eventLog.size).toBe(1);
  });

  it('chains consecutive sealed records and verifies the chain', async () => {
    const { service, sealed } = createInMemoryLedger();
    for (const req of ['REQ-A', 'REQ-B']) {
      await service.handleTransferInitiated({ ...initiated(['a1'], 'C2_TRANSFER'), data: { ...initiated(['a1'], 'C2_TRANSFER').data, requisitionNumber: req } });
      await service.handleTransferCompleted({
        meta: meta('completed'),
        data: { ...topologyBase('C2_TRANSFER', ['a1']), requisitionNumber: req, transferEventStatus: 'COMPLETED', receivedAssets: [] },
      });
    }

    expect(sealed.map((r) => r.sequence)).toEqual([1, 2]);
    expect(sealed[1].prevHash).toBe(sealed[0].recordHash);
    expect(await service.verifyLedger()).toEqual({ valid: true, checked: 2, failures: [] });
  });

  it('detects tampering and broken links', async () => {
    const { service, sealed } = createInMemoryLedger();
    for (const req of ['REQ-A', 'REQ-B']) {
      await service.handleTransferInitiated({ ...initiated(['a1'], 'C2_TRANSFER'), data: { ...initiated(['a1'], 'C2_TRANSFER').data, requisitionNumber: req } });
      await service.handleTransferCompleted({
        meta: meta('completed'),
        data: { ...topologyBase('C2_TRANSFER', ['a1']), requisitionNumber: req, transferEventStatus: 'COMPLETED', receivedAssets: [] },
      });
    }
    sealed[0].sender.name = 'Tampered';

    const result = await service.verifyLedger();
    expect(result.valid).toBe(false);
    expect(result.failures.map((f) => f.reason)).toEqual(expect.arrayContaining(['HASH_MISMATCH']));
    expect((await service.verifyTransfer('REQ-A'))?.valid).toBe(false);
    expect(await service.verifyTransfer('missing')).toBeNull();
  });

  it('dead-letters events arriving after the seal without changing the sealed record', async () => {
    const { service, sealed, deadLetters } = createInMemoryLedger();
    await service.handleTransferInitiated(initiated(['a1'], 'C2_TRANSFER'));
    await service.handleTransferCompleted({
      meta: meta('completed'),
      data: { ...topologyBase('C2_TRANSFER', ['a1']), transferEventStatus: 'COMPLETED', receivedAssets: [] },
    });
    const before = structuredClone(sealed[0]);

    await service.handleTransferReceived(received(RECEIPT_1, ['a1']));

    expect(sealed).toHaveLength(1);
    expect(sealed[0]).toEqual(before);
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]).toMatchObject({ reason: 'LATE_EVENT', requisitionNumber: REQ });
  });

  it('quarantines malformed payloads', async () => {
    const { service, deadLetters } = createInMemoryLedger();
    await service.quarantine('MALFORMED', 'events.x', { bad: true }, 'nope', { eventId: 'e1' });
    expect(await service.listDeadLetters()).toEqual(deadLetters);
    expect(deadLetters[0]).toMatchObject({ reason: 'MALFORMED', eventId: 'e1', detail: 'nope' });
  });

  it('lists sealed and open transfers together', async () => {
    const { service } = createInMemoryLedger();
    await service.handleTransferInitiated(initiated(['a1']));
    await service.handleTransferInitiated({ ...initiated(['a1'], 'C2_TRANSFER'), data: { ...initiated(['a1'], 'C2_TRANSFER').data, requisitionNumber: 'REQ-C2' } });
    await service.handleTransferCompleted({
      meta: meta('completed'),
      data: { ...topologyBase('C2_TRANSFER', ['a1']), requisitionNumber: 'REQ-C2', transferEventStatus: 'COMPLETED', receivedAssets: [] },
    });

    const all = await service.listTransfers({});
    expect(all.map((t) => [t.requisitionNumber, t.status]).sort()).toEqual([[REQ, 'OPEN'], ['REQ-C2', 'SEALED']]);
  });
});
