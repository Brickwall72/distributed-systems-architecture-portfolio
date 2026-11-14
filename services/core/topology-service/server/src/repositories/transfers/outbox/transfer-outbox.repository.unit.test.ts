// File: services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.unit.test.ts
import { transferOutboxItemSchema } from './transfer-outbox.repository';

it('preserves completion fields when validating a completed outbox event', () => {
  const asset = {
    id: 'asset', name: 'Asset', nomenclature: 'Test', serialNumber: '1',
    type: 'Test', status: 'AVAILABLE', controlType: 'LOCAL', currentOwnerId: 'receiver',
  };
  const data = {
    transferEventId: '00000000-0000-4000-8000-000000000003',
    requisitionNumber: 'REQ', transferType: 'PHYSICAL_TRANSFER', date: '2026-01-01T00:00:00.000Z',
    sender: { id: 'sender', name: 'Sender', type: 'CONTRACTOR' },
    receiver: { id: 'receiver', name: 'Receiver', type: 'CONTRACTOR' },
    assets: [asset], transferEventStatus: 'COMPLETED', receivedAssets: [asset],
  };
  const item = transferOutboxItemSchema.parse({
    documentId: '00000000-0000-4000-8000-000000000001',
    leaseId: '00000000-0000-4000-8000-000000000002',
    subject: 'events.topology.transfer.completed',
    event: {
      specversion: '1.0', id: 'evt-test', source: 'service:topology-server',
      type: 'com.system.topology.transfer.completed', time: '2026-01-01T00:00:00.000Z',
      datacontenttype: 'application/json', data,
    },
  });
  expect(item.event.data).toMatchObject(data);
});
