// File: packages/messaging/src/index.unit.test.ts
import { EventBroker, type Logger } from './index';

// Mock external NATS v3 modules
const mockClose = vi.fn();
const mockStreamsAdd = vi.fn();
const mockPublish = vi.fn();
const mockSubscribe = vi.fn();

const mockNc = { close: mockClose };
const mockJsm = { streams: { add: mockStreamsAdd } };
const mockJs = {
  publish: mockPublish,
  subscribe: mockSubscribe,
};

vi.mock('@nats-io/transport-node', () => ({
  connect: vi.fn(() => Promise.resolve(mockNc)),
}));

vi.mock('@nats-io/jetstream', () => ({
  jetstream: vi.fn(() => mockJs),
  jetstreamManager: vi.fn(() => Promise.resolve(mockJsm)),
}));

describe('EventBroker', () => {
  let broker: EventBroker;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock logger directly satisfying the structural Logger interface defined in index.ts
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    broker = new EventBroker('nats://localhost:4222', mockLogger);
  });

  describe('Structural Type Verification', () => {
    it('should compile and accept any custom logger matching the structural interface shape', () => {
      const minimalLogger: Logger = {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      };

      const customBroker = new EventBroker('nats://localhost:4222', minimalLogger);
      expect(customBroker).toBeInstanceOf(EventBroker);
    });
  });

  describe('connect & disconnect', () => {
    it('should connect to NATS and initialize JetStream contexts', async () => {
      await broker.connect();

      expect(mockLogger.info).toHaveBeenCalledWith('Connected to NATS Broker at nats://localhost:4222');
    });

    it('should gracefully close connection on disconnect', async () => {
      await broker.connect();
      await broker.disconnect();

      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('Disconnected from NATS Broker');
    });
  });

  describe('ensureStream', () => {
    it('should successfully add a stream', async () => {
      mockStreamsAdd.mockResolvedValueOnce({});
      await broker.connect();

      await broker.ensureStream('TEST_STREAM', ['test.>']);

      expect(mockStreamsAdd).toHaveBeenCalledWith({
        name: 'TEST_STREAM',
        subjects: ['test.>'],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Ensured JetStream 'TEST_STREAM' exists for subjects: test.>"
      );
    });

    it('should log a warning if stream creation throws an error', async () => {
      mockStreamsAdd.mockRejectedValueOnce(new Error('Stream already exists'));
      await broker.connect();

      await broker.ensureStream('TEST_STREAM', ['test.>']);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Stream check warning (might already exist): Stream already exists'
      );
    });
  });

  describe('publish', () => {
    it('should encode payload using TextEncoder and publish to NATS', async () => {
      mockPublish.mockResolvedValueOnce({ stream: 'TEST_STREAM', seq: 1 });
      await broker.connect();

      const payload = { meta: { domain: 'compliance' }, data: { id: '123' } };
      await broker.publish('events.test.created', payload, 'cid-999');

      expect(mockPublish).toHaveBeenCalledTimes(1);
      const [subject, encodedBytes] = mockPublish.mock.calls[0];

      expect(subject).toBe('events.test.created');

      // Decode Uint8Array bytes using TextDecoder
      const decodedJson = JSON.parse(new TextDecoder().decode(encodedBytes));
      expect(decodedJson).toEqual(payload);
      expect(mockLogger.debug).toHaveBeenCalledWith('Published event to events.test.created', 'cid-999');
    });

    it('should log an error and rethrow when publish fails', async () => {
      mockPublish.mockRejectedValueOnce(new Error('Publish timeout'));
      await broker.connect();

      await expect(
        broker.publish('events.test.failed', { foo: 'bar' }, 'cid-error')
      ).rejects.toThrow('Publish timeout');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to publish to events.test.failed: Publish timeout',
        'cid-error'
      );
    });
  });

  describe('subscribe', () => {
    it('should process inbound message stream, decode via msg.json(), and invoke handler with ack', async () => {
      const mockAck = vi.fn();
      const testPayload = { id: 'evt_101', status: 'SIGNED' };

      // Mock async generator yield matching NATS v3 Msg shape
      async function* mockSubscriptionStream() {
        yield {
          json: () => testPayload,
          ack: mockAck,
        };
      }

      mockSubscribe.mockResolvedValueOnce(mockSubscriptionStream());
      await broker.connect();

      const handlerSpy = vi.fn(async (_payload, ack) => {
        ack();
      });

      await broker.subscribe('events.esign.>', 'durable_test_consumer', handlerSpy);

      // Yield event loop briefly for generator processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSubscribe).toHaveBeenCalledWith('events.esign.>', {
        config: { durable_name: 'durable_test_consumer' },
      });
      expect(handlerSpy).toHaveBeenCalledWith(testPayload, expect.any(Function));
      expect(mockAck).toHaveBeenCalledTimes(1);
    });

    it('should catch and log errors thrown during message handler execution', async () => {
      async function* mockFailingStream() {
        yield {
          json: () => ({ bad: 'data' }),
          ack: vi.fn(),
        };
      }

      mockSubscribe.mockResolvedValueOnce(mockFailingStream());
      await broker.connect();

      const failingHandler = vi.fn(async () => {
        throw new Error('Database write failed');
      });

      await broker.subscribe('events.esign.>', 'failing_consumer', failingHandler);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing event on events.esign.>: Database write failed'
      );
    });
  });
});