// File: services/core/compliance-service/server/src/messaging/topology/topology-nats.client.unit.test.ts
import { TOPOLOGY_REQUEST_SUBJECTS } from '@contracts/topology';
import { TopologyConflict, TopologyUnavailable } from './topology-errors';
import { TopologyNatsClient } from './topology-nats.client';

describe('TopologyNatsClient', () => {
  const transferEventId = '00000000-0000-4000-8000-000000000001';
  const claim = {
    documentId: '00000000-0000-4000-8000-000000000002', draftHash: 'a'.repeat(64),
    creatorId: 'user', templateId: 'template', storageBucket: 'bucket', storageKey: 'key',
    signerOrgId: 'sender', senderOrgId: 'sender', receiverOrgId: 'receiver',
    requisitionNumber: 'req', transferType: 'PHYSICAL_TRANSFER' as const,
    operation: 'AUTHORIZATION' as const, assetIds: ['asset'],
  };

  it('uses the reservation subject and validates the transfer ID', async () => {
    const request = vi.fn().mockResolvedValue({ status: 'OK', transferEventId });
    const client = new TopologyNatsClient({ request });
    expect(await client.reserve(claim)).toEqual({ transferEventId });
    expect(request).toHaveBeenCalledWith(TOPOLOGY_REQUEST_SUBJECTS.RESERVE, claim, { timeout: 10_000 });
  });

  it('distinguishes a conflict from a transport or response failure', async () => {
    const request = vi.fn().mockResolvedValueOnce({ status: 'CONFLICT', message: 'Unavailable asset' })
      .mockRejectedValueOnce(new Error('no responders'))
      .mockResolvedValueOnce({ status: 'OK', transferEventId: 'invalid' });
    const client = new TopologyNatsClient({ request });
    await expect(client.reserve(claim)).rejects.toBeInstanceOf(TopologyConflict);
    await expect(client.reserve(claim)).rejects.toBeInstanceOf(TopologyUnavailable);
    await expect(client.reserve(claim)).rejects.toBeInstanceOf(TopologyUnavailable);
  });
});
