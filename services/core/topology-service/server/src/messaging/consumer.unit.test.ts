import type { EventBroker } from '@shared/messaging';
import { COMPLIANCE_EVENT_SUBJECTS, TransferInitiatedEventSchema, TransferReceivedEventSchema } from '@contracts/compliance';
import { mockFromSchema } from '@shared/testing';
import { ComplianceEventConsumer } from './consumer';
import { handleTransferInitiatedParamsSchema, handleTransferReceivedParamsSchema, type TransfersRepository } from '../repositories';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

type Handler = (event: unknown, ack: () => void) => Promise<void>;

describe('ComplianceEventConsumer', () => {
  let broker: { ensureStream: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
  let repo: { handleTransferInitiated: ReturnType<typeof vi.fn>; handleTransferReceived: ReturnType<typeof vi.fn> };
  const handlers: Record<string, Handler> = {};

  beforeEach(async () => {
    vi.clearAllMocks();
    broker = {
      ensureStream: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(async (_stream: string, _durable: string, handler: Handler, filter: string) => {
        handlers[filter] = handler;
      }),
    };
    repo = {
      handleTransferInitiated: vi.fn().mockResolvedValue(undefined),
      handleTransferReceived: vi.fn().mockResolvedValue(undefined),
    };
    await new ComplianceEventConsumer(broker as unknown as EventBroker, repo as unknown as TransfersRepository).start();
  });

  it('ensures the compliance stream and subscribes to both transfer subjects', () => {
    expect(broker.ensureStream).toHaveBeenCalledWith(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [
      COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL,
    ]);
    expect(broker.subscribe.mock.calls.map((call) => call[3]).sort()).toEqual([
      COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED,
      COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED,
    ].sort());
  });

  it('maps a globally-contracted initiated event onto the repository params and acks', async () => {
    const event = mockFromSchema(TransferInitiatedEventSchema);
    const ack = vi.fn();

    await handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED](event, ack);

    const [params] = repo.handleTransferInitiated.mock.calls[0];
    expect(handleTransferInitiatedParamsSchema.parse(params)).toEqual({
      requisitionNumber: event.data.requisitionNumber,
      assetIds: event.data.assetIds,
      date: event.data.date,
      type: event.data.transferType,
      senderOrgId: event.data.senderOrgId,
      receiverOrgId: event.data.receiverOrgId,
    });
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('passes a globally-contracted received event to the repository and acks', async () => {
    const event = mockFromSchema(TransferReceivedEventSchema);
    const ack = vi.fn();

    await handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED](event, ack);

    expect(repo.handleTransferReceived).toHaveBeenCalledWith(handleTransferReceivedParamsSchema.parse(event.data));
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('does not ack when the payload violates the local schema', async () => {
    const event = mockFromSchema(TransferReceivedEventSchema);
    const ack = vi.fn();

    await expect(
      handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED]({ ...event, data: { assetIds: 'nope' } }, ack),
    ).rejects.toThrow();
    expect(repo.handleTransferReceived).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
  });

  it('does not ack when the repository fails', async () => {
    repo.handleTransferInitiated.mockRejectedValueOnce(new Error('neo4j down'));
    const ack = vi.fn();

    await expect(
      handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED](mockFromSchema(TransferInitiatedEventSchema), ack),
    ).rejects.toThrow('neo4j down');
    expect(ack).not.toHaveBeenCalled();
  });
});
