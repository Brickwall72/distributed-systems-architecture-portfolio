// File: services/core/topology-service/server/src/services/transfer-outbox.service.unit.test.ts
import { TransferOutboxService } from './transfer-outbox.service';
import type { TransferOutboxItem } from '../repositories/transfers';

describe('TransferOutboxService', () => {
  const item: TransferOutboxItem = {
    documentId: '00000000-0000-4000-8000-000000000001',
    leaseId: '00000000-0000-4000-8000-000000000002',
    subject: 'events.topology.transfer.updated',
    event: {
      specversion: '1.0', id: 'evt-test', source: 'service:topology-server',
      type: 'com.system.topology.transfer.updated', time: '2026-01-01T00:00:00.000Z',
      datacontenttype: 'application/json',
      data: {
        transferEventId: '00000000-0000-4000-8000-000000000003',
        transferEventStatus: 'PARTIALLY_COMPLETED',
        documentId: '00000000-0000-4000-8000-000000000001',
        receivedAssets: [{
          id: 'asset', name: 'Asset', nomenclature: 'Test', serialNumber: '1',
          type: 'Test', status: 'AVAILABLE', controlType: 'LOCAL', currentOwnerId: 'receiver',
        }],
      },
    },
  };

  it('acknowledges an event only after it has been published', async () => {
    const repository = { claimNext: vi.fn().mockResolvedValue(item), markPublished: vi.fn().mockResolvedValue(undefined) };
    const broker = { publish: vi.fn().mockResolvedValue(undefined) };
    const service = new TransferOutboxService(repository, broker);
    expect(await service.publishNext()).toBe(true);
    expect(broker.publish).toHaveBeenCalledWith(item.subject, item.event);
    expect(repository.markPublished).toHaveBeenCalledWith(item);
    expect(broker.publish.mock.invocationCallOrder[0]).toBeLessThan(repository.markPublished.mock.invocationCallOrder[0]);
  });

  it('leaves a failed publication unacknowledged for lease-based retry', async () => {
    const repository = { claimNext: vi.fn().mockResolvedValue(item), markPublished: vi.fn() };
    const broker = { publish: vi.fn().mockRejectedValue(new Error('broker unavailable')) };
    const service = new TransferOutboxService(repository, broker);
    await expect(service.publishNext()).rejects.toThrow('broker unavailable');
    expect(repository.markPublished).not.toHaveBeenCalled();
  });

  it('does nothing when no event is available', async () => {
    const repository = { claimNext: vi.fn().mockResolvedValue(null), markPublished: vi.fn() };
    const broker = { publish: vi.fn() };
    const service = new TransferOutboxService(repository, broker);
    expect(await service.publishNext()).toBe(false);
    expect(broker.publish).not.toHaveBeenCalled();
  });
});
