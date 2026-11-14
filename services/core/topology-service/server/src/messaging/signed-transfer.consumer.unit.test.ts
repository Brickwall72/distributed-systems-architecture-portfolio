// File: services/core/topology-service/server/src/messaging/signed-transfer.consumer.unit.test.ts
import { TOPOLOGY_SIGNED_EVENT_SUBJECT, TOPOLOGY_SIGNED_EVENT_TYPE } from '@contracts/topology';
import { startSignedTransferConsumer } from './signed-transfer.consumer';

describe('signed transfer consumer', () => {
  const documentId = '00000000-0000-4000-8000-000000000001';
  const event = {
    specversion: '1.0', id: `evt_compliance_signed_${documentId}`, source: 'service:compliance-server',
    type: TOPOLOGY_SIGNED_EVENT_TYPE, time: '2026-01-01T00:00:00.000Z',
    datacontenttype: 'application/json', correlationId: `claim_${documentId}`,
    data: { documentId, transferEventId: '00000000-0000-4000-8000-000000000002',
      draftHash: 'a'.repeat(64), signedFileHash: 'b'.repeat(64) },
  };

  it('acknowledges only after a validated event is committed', async () => {
    const waitForStream = vi.fn();
    const subscribe = vi.fn();
    const commitSigned = vi.fn();
    await startSignedTransferConsumer({ waitForStream, subscribe }, { commitSigned });
    const handler = subscribe.mock.calls[0][2];
    expect(subscribe.mock.calls[0][3]).toBe(TOPOLOGY_SIGNED_EVENT_SUBJECT);
    const ack = vi.fn();
    await handler(event, ack);
    expect(commitSigned).toHaveBeenCalledWith(event);
    expect(commitSigned.mock.invocationCallOrder[0]).toBeLessThan(ack.mock.invocationCallOrder[0]);
  });

  it('does not acknowledge malformed or failed events', async () => {
    const subscribe = vi.fn();
    const commitSigned = vi.fn().mockRejectedValue(new Error('database unavailable'));
    await startSignedTransferConsumer({ waitForStream: vi.fn(), subscribe }, { commitSigned });
    const handler = subscribe.mock.calls[0][2];
    const ack = vi.fn();
    await expect(handler({ ...event, source: 'untrusted' }, ack)).rejects.toThrow('identity is invalid');
    await expect(handler(event, ack)).rejects.toThrow('database unavailable');
    expect(ack).not.toHaveBeenCalled();
  });
});
