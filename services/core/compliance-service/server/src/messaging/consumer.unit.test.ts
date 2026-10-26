// File: services/core/compliance-service/server/src/messaging/consumer.unit.test.ts
import type { EventBroker } from '@shared/messaging';
import { zocker } from 'zocker';
import {
  TOPOLOGY_EVENT_SUBJECTS,
  transferEventCreatedEventSchema,
  transferEventUpdatedEventSchema,
  transferEventCompletedEventSchema,
} from '@contracts/topology';
import {
  handleTransferEventCreatedDataSchema,
  handleTransferEventUpdatedDataSchema,
  handleTransferEventCompletedDataSchema,
  type TransferService,
} from '../services';
import { ComplianceEventConsumer } from './consumer';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

type Handler = (event: unknown, ack: () => void) => Promise<void>;

describe('ComplianceEventConsumer', () => {
  let broker: { ensureStream: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
  let transferService: {
    handleTransferEventCreated: ReturnType<typeof vi.fn>;
    handleTransferEventUpdated: ReturnType<typeof vi.fn>;
    handleTransferEventCompleted: ReturnType<typeof vi.fn>;
  };
  const handlers: Record<string, Handler> = {};

  beforeEach(async () => {
    vi.clearAllMocks();
    Object.values(TOPOLOGY_EVENT_SUBJECTS).forEach((subject) => delete handlers[subject]);
    broker = {
      ensureStream: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(async (_stream: string, _durable: string, handler: Handler, subject: string) => {
        handlers[subject] = handler;
      }),
    };
    transferService = {
      handleTransferEventCreated: vi.fn().mockResolvedValue(undefined),
      handleTransferEventUpdated: vi.fn().mockResolvedValue(undefined),
      handleTransferEventCompleted: vi.fn().mockResolvedValue(undefined),
    };

    await new ComplianceEventConsumer(
      broker as unknown as EventBroker,
      transferService as unknown as TransferService,
    ).start();
  });

  it('ensures the topology stream and subscribes to all transfer subjects', () => {
    expect(broker.ensureStream).toHaveBeenCalledWith(TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME, [
      TOPOLOGY_EVENT_SUBJECTS.WILDCARD_ALL,
    ]);
    expect(broker.subscribe.mock.calls.map((call) => call[3]).sort()).toEqual([
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED,
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED,
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED,
    ].sort());
  });

  it.each([
    [
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED,
      transferEventCreatedEventSchema,
      handleTransferEventCreatedDataSchema,
      'handleTransferEventCreated',
    ],
    [
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED,
      transferEventUpdatedEventSchema,
      handleTransferEventUpdatedDataSchema,
      'handleTransferEventUpdated',
    ],
    [
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED,
      transferEventCompletedEventSchema,
      handleTransferEventCompletedDataSchema,
      'handleTransferEventCompleted',
    ],
  ] as const)('transforms %s data and acks after service success', async (subject, eventSchema, inputSchema, method) => {
    const event = zocker(eventSchema).generate();
    const ack = vi.fn();

    await handlers[subject](event, ack);

    expect(transferService[method]).toHaveBeenCalledWith(inputSchema.parse(event.data));
    expect(ack).toHaveBeenCalledOnce();
  });

  it('does not ack when the service rejects', async () => {
    transferService.handleTransferEventCreated.mockRejectedValueOnce(new Error('database unavailable'));
    const event = zocker(transferEventCreatedEventSchema).generate();
    const ack = vi.fn();

    await expect(
      handlers[TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED](event, ack),
    ).rejects.toThrow('database unavailable');
    expect(ack).not.toHaveBeenCalled();
  });

  it('does not ack an event that fails the local boundary schema', async () => {
    const event = zocker(transferEventCreatedEventSchema).generate();
    const ack = vi.fn();

    await expect(
      handlers[TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED]({
        ...event,
        data: { ...event.data, transferEventId: 'not-a-uuid' },
      }, ack),
    ).rejects.toThrow();
    expect(transferService.handleTransferEventCreated).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
  });
});
