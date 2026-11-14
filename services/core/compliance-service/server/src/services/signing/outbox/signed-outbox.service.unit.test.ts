// File: services/core/compliance-service/server/src/services/signing/outbox/signed-outbox.service.unit.test.ts
import { TOPOLOGY_SIGNED_EVENT_SUBJECT, TOPOLOGY_SIGNED_EVENT_TYPE } from '@contracts/topology';
import { SignedOutboxService } from './signed-outbox.service';

describe('SignedOutboxService', () => {
  const documentId = '00000000-0000-4000-8000-000000000001';
  const item = {
    eventId: `evt_compliance_signed_${documentId}`,
    subject: TOPOLOGY_SIGNED_EVENT_SUBJECT,
    leaseId: '00000000-0000-4000-8000-000000000002',
    payload: {
      specversion: '1.0', id: `evt_compliance_signed_${documentId}`, source: 'service:compliance-server',
      type: TOPOLOGY_SIGNED_EVENT_TYPE, time: '2026-01-01T00:00:00.000Z',
      datacontenttype: 'application/json', correlationId: `claim_${documentId}`,
      data: { documentId, transferEventId: '00000000-0000-4000-8000-000000000003',
        draftHash: 'a'.repeat(64), signedFileHash: 'b'.repeat(64) },
    },
  };

  it('marks a validated event published only after broker acknowledgement', async () => {
    const repository = { claimNext: vi.fn().mockResolvedValue(item), markPublished: vi.fn(), defer: vi.fn(), flagStalled: vi.fn() };
    const broker = { publish: vi.fn() };
    const service = new SignedOutboxService(repository, broker);
    expect(await service.publishNext()).toBe(true);
    expect(broker.publish).toHaveBeenCalledWith(item.subject, item.payload);
    expect(broker.publish.mock.invocationCallOrder[0]).toBeLessThan(repository.markPublished.mock.invocationCallOrder[0]);
    expect(repository.defer).not.toHaveBeenCalled();
  });

  it('defers a failed publication with the same persisted item', async () => {
    const repository = { claimNext: vi.fn().mockResolvedValue(item), markPublished: vi.fn(), defer: vi.fn(), flagStalled: vi.fn() };
    const broker = { publish: vi.fn().mockRejectedValue(new Error('broker offline')) };
    const service = new SignedOutboxService(repository, broker);
    await expect(service.publishNext()).rejects.toThrow('broker offline');
    expect(repository.defer).toHaveBeenCalledWith(item, 'broker offline');
    expect(repository.markPublished).not.toHaveBeenCalled();
  });

  it('does not publish an invalid subject or payload', async () => {
    const invalid = { ...item, subject: 'events.unknown' };
    const repository = { claimNext: vi.fn().mockResolvedValue(invalid), markPublished: vi.fn(), defer: vi.fn(), flagStalled: vi.fn() };
    const broker = { publish: vi.fn() };
    await expect(new SignedOutboxService(repository, broker).publishNext()).rejects.toThrow('Unknown signed outbox subject');
    expect(broker.publish).not.toHaveBeenCalled();
    expect(repository.defer).toHaveBeenCalledOnce();
  });
});
