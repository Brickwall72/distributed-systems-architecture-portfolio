import { zocker } from 'zocker';
import type { EventBroker } from '@shared/messaging';
import {
  COMPLIANCE_EVENT_SUBJECTS,
  COMPLIANCE_EVENT_TYPES,
  transferInitiatedEventSchema,
  TransferReceivedEventSchema,
  transferReceivedDataSchema,
} from '@contracts/compliance';
import {
  CompliancePublisher,
  publishTransferInitiatedInputSchema,
  publishtransferInitiatedDataSchema,
} from './publisher';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('CompliancePublisher', () => {
  let broker: { publish: ReturnType<typeof vi.fn>; ensureStream: ReturnType<typeof vi.fn> };
  let publisher: CompliancePublisher;

  beforeEach(() => {
    broker = { publish: vi.fn().mockResolvedValue(undefined), ensureStream: vi.fn().mockResolvedValue(undefined) };
    publisher = new CompliancePublisher(broker as unknown as EventBroker);
  });

  it('ensures the compliance stream covers all compliance subjects', async () => {
    await publisher.init();
    expect(broker.ensureStream).toHaveBeenCalledWith(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL]);
  });

  it('publishes a CloudEvent satisfying the shared transfer-initiated schema', async () => {
    const input = zocker(publishTransferInitiatedInputSchema).generate();
    const data = publishtransferInitiatedDataSchema.parse(input);

    await publisher.publishTransferInitiated(data, 'cid_test');

    const [subject, event] = broker.publish.mock.calls[0];
    expect(subject).toBe(COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED);
    expect(transferInitiatedEventSchema.parse(event)).toEqual(event);
    expect(event).toMatchObject({
      type: COMPLIANCE_EVENT_TYPES.TRANSFER_INITIATED,
      correlationId: 'cid_test',
      data,
    });
  });

  it('publishes a CloudEvent satisfying the shared transfer-received schema and generates a correlation id when absent', async () => {
    const data = zocker(transferReceivedDataSchema).generate();

    await publisher.publishTransferReceived(data);

    const [subject, event] = broker.publish.mock.calls[0];
    expect(subject).toBe(COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED);
    expect(TransferReceivedEventSchema.parse(event)).toEqual(event);
    expect(event.correlationId).toMatch(/^cid_/);
  });

  it('rejects payloads that violate the shared event data contract before publishing', async () => {
    await expect(
      publisher.publishTransferInitiated({ requisitionNumber: 'REQ-1' } as never),
    ).rejects.toThrow();
    expect(broker.publish).not.toHaveBeenCalled();
  });
});
