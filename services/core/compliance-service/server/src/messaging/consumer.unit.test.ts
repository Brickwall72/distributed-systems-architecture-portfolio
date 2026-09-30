// File: services/core/compliance-service/server/src/messaging/consumer.unit.test.ts
import { ESignEventConsumer } from './consumer.js';
import { EventBroker } from '@shared/messaging';
import { ComplianceDocumentRepository } from '../db/documents.repository.js';
import { ESIGN_SUBJECTS } from '@contracts/esign';
import { handleDocumentSignedEvent } from './handlers.js';

vi.mock('./handlers.js', () => ({
  handleDocumentSignedEvent: vi.fn(),
}));

describe('ESignEventConsumer', () => {
  let mockBroker: {
    ensureStream: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
  let mockRepository: ComplianceDocumentRepository;
  let consumer: ESignEventConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBroker = {
      ensureStream: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
    };
    mockRepository = {} as unknown as ComplianceDocumentRepository;
    consumer = new ESignEventConsumer(
      mockBroker as unknown as EventBroker,
      mockRepository
    );
  });

  describe('start', () => {
    it('ensures the JetStream stream exists with wildcard subjects', async () => {
      await consumer.start();

      expect(mockBroker.ensureStream).toHaveBeenCalledTimes(1);
      expect(mockBroker.ensureStream).toHaveBeenCalledWith(
        ESIGN_SUBJECTS.STREAM_NAME,
        [ESIGN_SUBJECTS.WILDCARD_ALL]
      );
    });

    it('subscribes to the event broker with correct durable name and subject filter', async () => {
      await consumer.start();

      expect(mockBroker.subscribe).toHaveBeenCalledTimes(1);
      expect(mockBroker.subscribe).toHaveBeenCalledWith(
        ESIGN_SUBJECTS.STREAM_NAME,
        'compliance-server-document-signed-consumer',
        expect.any(Function),
        ESIGN_SUBJECTS.DOCUMENT_SIGNED
      );
    });

    it('successfully processes messages and acknowledges them via ack()', async () => {
      vi.mocked(handleDocumentSignedEvent).mockResolvedValueOnce(undefined);

      await consumer.start();

      // Extract the callback registered via broker.subscribe
      const subscriptionCallback = mockBroker.subscribe.mock.calls[0][2];
      const mockPayload = { id: 'evt_123' };
      const mockAck = vi.fn();

      await subscriptionCallback(mockPayload, mockAck);

      expect(handleDocumentSignedEvent).toHaveBeenCalledTimes(1);
      expect(handleDocumentSignedEvent).toHaveBeenCalledWith(
        mockPayload,
        mockRepository
      );
      expect(mockAck).toHaveBeenCalledTimes(1);
    });

    it('propagates errors and does not call ack() if handler throws', async () => {
      const handlerError = new Error('Database write failed');
      vi.mocked(handleDocumentSignedEvent).mockRejectedValueOnce(handlerError);

      await consumer.start();

      const subscriptionCallback = mockBroker.subscribe.mock.calls[0][2];
      const mockPayload = { id: 'evt_123' };
      const mockAck = vi.fn();

      await expect(subscriptionCallback(mockPayload, mockAck)).rejects.toThrow(
        'Database write failed'
      );

      expect(handleDocumentSignedEvent).toHaveBeenCalledWith(
        mockPayload,
        mockRepository
      );
      expect(mockAck).not.toHaveBeenCalled();
    });
  });
});