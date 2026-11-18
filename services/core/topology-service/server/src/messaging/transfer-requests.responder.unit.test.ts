// File: services/core/topology-service/server/src/messaging/transfer-requests.responder.unit.test.ts
import { TOPOLOGY_REQUEST_SUBJECTS } from '@contracts/topology';
import { TransferClaimConflict } from '../repositories/transfers';
import { registerTransferRequestResponders } from './transfer-requests.responder';

afterEach(() => vi.restoreAllMocks());

describe('topology transfer request responders', () => {
  const transferEventId = '00000000-0000-4000-8000-000000000001';
  const claim = {
    documentId: '00000000-0000-4000-8000-000000000002', draftHash: 'a'.repeat(64),
    creatorId: 'user', templateId: 'template', storageBucket: 'bucket', storageKey: 'key',
    signerOrgId: 'sender', senderOrgId: 'sender', receiverOrgId: 'receiver',
    requisitionNumber: 'req', transferType: 'PHYSICAL_TRANSFER', operation: 'AUTHORIZATION', assetIds: ['asset'],
  };

  it('uses a queue group and rejects invalid, conflicting, and unavailable reservations', async () => {
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handlers = new Map<string, (input: unknown) => Promise<unknown>>();
    const respond = vi.fn((subject, handler) => { handlers.set(subject, handler); });
    const reserveForSigning = vi.fn().mockResolvedValueOnce({ transferEventId })
      .mockRejectedValueOnce(new TransferClaimConflict('asset is reserved'))
      .mockRejectedValueOnce(new Error('database unavailable'));
    registerTransferRequestResponders({ respond }, { reserveForSigning }, { validate: vi.fn() });

    expect(respond).toHaveBeenCalledWith(
      TOPOLOGY_REQUEST_SUBJECTS.RESERVE, expect.any(Function), { queue: 'topology-transfer-reservations' },
    );
    const reserve = handlers.get(TOPOLOGY_REQUEST_SUBJECTS.RESERVE);
    if (!reserve) throw new Error('Reservation responder was not registered');
    expect(await reserve({})).toMatchObject({ status: 'INVALID' });
    expect(await reserve(claim)).toEqual({ status: 'OK', transferEventId });
    expect(await reserve(claim)).toMatchObject({ status: 'CONFLICT' });
    expect(await reserve(claim)).toMatchObject({ status: 'UNAVAILABLE' });
    const outcomes = logs.mock.calls.map(([line]) => JSON.parse(line))
      .filter((record) => record.phase === 'end');
    expect(outcomes.map((record) => [record.outcome, record.level])).toEqual([
      ['rejected', 'WARN'], ['success', 'INFO'], ['rejected', 'WARN'], ['failure', 'ERROR'],
    ]);
  });
});
