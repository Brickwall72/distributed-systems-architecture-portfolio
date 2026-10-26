// File: services/core/topology-service/server/src/messaging/publisher.unit.test.ts
import type { EventBroker } from '@shared/messaging';
import { zocker } from 'zocker';
import {
  TOPOLOGY_EVENT_SUBJECTS,
  TOPOLOGY_EVENT_TYPES,
  transferEventCreatedDataSchema,
  transferEventCreatedEventSchema,
  transferEventUpdatedDataSchema,
  transferEventUpdatedEventSchema,
  transferEventCompletedDataSchema,
  transferEventCompletedEventSchema,
} from '@contracts/topology';
import { TopologyPublisher } from './publisher';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('TopologyPublisher', () => {
  let broker: { publish: ReturnType<typeof vi.fn>; ensureStream: ReturnType<typeof vi.fn> };
  let publisher: TopologyPublisher;

  beforeEach(() => {
    vi.clearAllMocks();
    broker = {
      publish: vi.fn().mockResolvedValue(undefined),
      ensureStream: vi.fn().mockResolvedValue(undefined),
    };
    publisher = new TopologyPublisher(broker as unknown as EventBroker);
  });

  it('ensures the topology stream covers all subjects', async () => {
    await publisher.init();

    expect(broker.ensureStream).toHaveBeenCalledWith(
      TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME,
      [TOPOLOGY_EVENT_SUBJECTS.WILDCARD_ALL],
    );
  });

  it('publishes a schema-valid created event and preserves the correlation id', async () => {
    const data = zocker(transferEventCreatedDataSchema).generate();

    await publisher.publishTransferEventCreated(data, 'cid-test');

    const [subject, event] = broker.publish.mock.calls[0];
    expect(subject).toBe(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED);
    expect(transferEventCreatedEventSchema.parse(event)).toEqual(event);
    expect(event).toMatchObject({
      type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_CREATED,
      correlationId: 'cid-test',
      data,
    });
  });

  it('publishes a schema-valid updated event and preserves the correlation id', async () => {
    const data = zocker(transferEventUpdatedDataSchema).generate();

    await publisher.publishTransferEventUpdated(data, 'cid-test');

    const [subject, event] = broker.publish.mock.calls[0];
    expect(subject).toBe(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED);
    expect(transferEventUpdatedEventSchema.parse(event)).toEqual(event);
    expect(event).toMatchObject({
      type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_UPDATED,
      correlationId: 'cid-test',
      data,
    });
  });

  it('publishes a schema-valid completed event and preserves the correlation id', async () => {
    const data = zocker(transferEventCompletedDataSchema).generate();

    await publisher.publishTransferEventCompleted(data, 'cid-test');

    const [subject, event] = broker.publish.mock.calls[0];
    expect(subject).toBe(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED);
    expect(transferEventCompletedEventSchema.parse(event)).toEqual(event);
    expect(event).toMatchObject({
      type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_COMPLETED,
      correlationId: 'cid-test',
      data,
    });
  });

  it('generates a correlation id when one is omitted', async () => {
    const data = zocker(transferEventCreatedDataSchema).generate();

    await publisher.publishTransferEventCreated(data);

    const [, event] = broker.publish.mock.calls[0];
    expect(event.correlationId).toMatch(/^cid_/);
  });

  it('does not publish data that violates the shared contract', async () => {
    await expect(
      publisher.publishTransferEventCreated({ transferEventId: 'not-a-uuid' } as never),
    ).rejects.toThrow();
    expect(broker.publish).not.toHaveBeenCalled();
  });
});
