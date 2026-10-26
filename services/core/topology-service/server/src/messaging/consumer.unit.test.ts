// File: services/core/topology-service/server/src/messaging/consumer.unit.test.ts
import type { EventBroker } from '@shared/messaging';
import {
  COMPLIANCE_EVENT_SUBJECTS,
  transferInitiatedEventSchema,
  TransferReceivedEventSchema,
} from '@contracts/compliance';
import { zocker } from 'zocker';
import { ComplianceEventConsumer } from './consumer';
import {
  handletransferReceivedDataSchema,
  handleTransferInitiatedDataSchema,
  type TransferService,
} from '../services';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

type Handler = (event: unknown, ack: () => void) => Promise<void>;

describe('ComplianceEventConsumer', () => {
  let broker: { ensureStream: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
  let transferService: {
    handleTransferInitiated: ReturnType<typeof vi.fn>;
    handleTransferReceived: ReturnType<typeof vi.fn>;
  };
  const handlers: Record<string, Handler> = {};

  beforeEach(async () => {
    vi.clearAllMocks();
    delete handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED];
    delete handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED];
    broker = {
      ensureStream: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(async (_stream: string, _durable: string, handler: Handler, filter: string) => {
        handlers[filter] = handler;
      }),
    };
    transferService = {
      handleTransferInitiated: vi.fn().mockResolvedValue(undefined),
      handleTransferReceived: vi.fn().mockResolvedValue(undefined),
    };
    await new ComplianceEventConsumer(
      broker as unknown as EventBroker,
      transferService as unknown as TransferService,
    ).start();
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

  it('maps an initiated event for the transfer service and acks after it succeeds', async () => {
    const event = zocker(transferInitiatedEventSchema).generate();
    const ack = vi.fn();

    await handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED](event, ack);

    expect(transferService.handleTransferInitiated).toHaveBeenCalledWith(
      handleTransferInitiatedDataSchema.parse(event.data),
    );
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('passes a received event to the transfer service and acks after it succeeds', async () => {
    const event = zocker(TransferReceivedEventSchema).generate();
    const ack = vi.fn();

    await handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED](event, ack);

    expect(transferService.handleTransferReceived).toHaveBeenCalledWith(
      handletransferReceivedDataSchema.parse(event.data),
    );
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('does not ack when the payload violates the local schema', async () => {
    const event = zocker(TransferReceivedEventSchema).generate();
    const ack = vi.fn();

    await expect(
      handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED]({ ...event, data: { assetIds: 'nope' } }, ack),
    ).rejects.toThrow();
    expect(transferService.handleTransferReceived).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
  });

  it('does not ack when the transfer service fails', async () => {
    transferService.handleTransferInitiated.mockRejectedValueOnce(new Error('transfer service failed'));
    const ack = vi.fn();

    await expect(
      handlers[COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED](
        zocker(transferInitiatedEventSchema).generate(),
        ack,
      ),
    ).rejects.toThrow('transfer service failed');
    expect(ack).not.toHaveBeenCalled();
  });
});
