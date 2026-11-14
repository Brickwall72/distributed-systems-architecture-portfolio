// File: services/core/audit-ledger/server/src/messaging/consumer.unit.test.ts
import { AuditEventConsumer } from './consumer';
import type { EventBroker } from '@shared/messaging';
import type { LedgerService } from '../services';

type Handler = (payload: unknown, ack: () => void) => Promise<void>;

function setup() {
  const handlers = new Map<string, { handler: Handler; options?: { nakDelayMs?: number } }>();
  const broker = {
    waitForStream: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(async (_s: string, durable: string, handler: Handler, _f?: string, options?: { nakDelayMs?: number }) => {
      handlers.set(durable, { handler, options });
    }),
  } as unknown as EventBroker;
  const service = {
    quarantine: vi.fn().mockResolvedValue(undefined),
    handleTransferInitiated: vi.fn().mockResolvedValue(undefined),
  } as unknown as LedgerService;
  return { broker, service, handlers };
}

describe('AuditEventConsumer', () => {
  it('registers five uniquely named durable consumers with a redelivery delay', async () => {
    const { broker, service, handlers } = setup();
    await new AuditEventConsumer(broker, service).start();

    expect([...handlers.keys()].sort()).toEqual([
      'audit-ledger-transfer-completed-consumer',
      'audit-ledger-transfer-created-consumer',
      'audit-ledger-transfer-initiated-consumer',
      'audit-ledger-transfer-received-consumer',
      'audit-ledger-transfer-updated-consumer',
    ]);
    for (const { options } of handlers.values()) expect(options?.nakDelayMs).toBeGreaterThan(0);
  });

  it('dead-letters and acks malformed events instead of retrying them', async () => {
    const { broker, service, handlers } = setup();
    await new AuditEventConsumer(broker, service).start();
    const ack = vi.fn();

    await handlers.get('audit-ledger-transfer-initiated-consumer')!.handler({ id: 'e1', data: { requisitionNumber: 'REQ-9' } }, ack);

    expect(service.quarantine).toHaveBeenCalledWith(
      'MALFORMED', 'events.compliance.transfer.initiated', expect.anything(), expect.any(String),
      { eventId: 'e1', requisitionNumber: 'REQ-9' }
    );
    expect(ack).toHaveBeenCalledTimes(1);
    expect(service.handleTransferInitiated).not.toHaveBeenCalled();
  });

  it('lets service failures propagate without acking so the broker redelivers', async () => {
    const { broker, service, handlers } = setup();
    (service.handleTransferInitiated as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('mongo down'));
    await new AuditEventConsumer(broker, service).start();
    const ack = vi.fn();
    const event = {
      specversion: '1.0', id: 'e1', source: 's', type: 't', time: '2025-01-01T00:00:00.000Z', datacontenttype: 'application/json',
      data: {
        documentId: '22222222-2222-4222-8222-222222222222', documentName: 'd', documentType: 't', fileHash: 'a'.repeat(64),
        signerId: 'u', signedAt: '2025-01-01T00:00:00.000Z', assetIds: [], requisitionNumber: 'R', date: '2025-01-01T00:00:00.000Z',
        transferType: 'C2_TRANSFER', senderOrgId: 'a', receiverOrgId: 'b',
      },
    };

    await expect(handlers.get('audit-ledger-transfer-initiated-consumer')!.handler(event, ack)).rejects.toThrow('mongo down');
    expect(ack).not.toHaveBeenCalled();
  });
});
