// File: packages/messaging/src/index.unit.test.ts
import { EventBroker, Logger } from './index.js';

// Mocks for NATS transport and JetStream
const mockNc = {
  close: vi.fn().mockResolvedValue(undefined),
};

const mockConsumer = {
  consume: vi.fn(),
};

const mockJs = {
  publish: vi.fn().mockResolvedValue({ stream: 'TEST', seq: 1 }),
  consumers: {
    get: vi.fn(),
  },
};

const mockJsm = {
  streams: {
    add: vi.fn().mockResolvedValue({ name: 'TEST_STREAM' }),
  },
  consumers: {
    add: vi.fn().mockResolvedValue({ name: 'TEST_CONSUMER' }),
  },
};

vi.mock('@nats-io/transport-node', () => ({
  connect: vi.fn(() => Promise.resolve(mockNc)),
}));

vi.mock('@nats-io/jetstream', () => ({
  jetstream: vi.fn(() => mockJs),
  jetstreamManager: vi.fn(() => Promise.resolve(mockJsm)),
  AckPolicy: {
    Explicit: 'explicit',
  },
}));

describe('EventBroker', () => {
  let logger: Logger;
  let broker: EventBroker;
  const natsUrl = 'nats://localhost:4222';

  beforeEach(() => {
    vi.clearAllMocks();

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    broker = new EventBroker(natsUrl, logger);
  });

  describe('constructor', () => {
    it('should throw an error if natsUrl is empty or undefined', () => {
      expect(() => new EventBroker('', logger)).toThrow(
        'EventBroker initialization failed: NATS URL is required but was undefined or empty.'
      );
    });

    it('should instantiate successfully with a valid NATS URL', () => {
      expect(broker).toBeDefined();
    });
  });

  describe('connect and disconnect', () => {
    it('should establish connection and initialize JetStream clients', async () => {
      await broker.connect();

      expect(logger.info).toHaveBeenCalledWith(
        `Attempting connection to NATS Broker at ${natsUrl}`
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Successfully connected to NATS Broker at ${natsUrl}`
      );
    });

    it('should gracefully close the connection on disconnect', async () => {
      await broker.connect();
      await broker.disconnect();

      expect(mockNc.close).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Disconnected from NATS Broker');
    });

    it('should handle disconnect safely if connect was never called', async () => {
      await expect(broker.disconnect()).resolves.not.toThrow();
      expect(mockNc.close).not.toHaveBeenCalled();
    });
  });

  describe('ensureStream', () => {
    beforeEach(async () => {
      await broker.connect();
    });

    it('should add a stream via JetStream manager', async () => {
      const streamName = 'ESIGN_EVENTS';
      const subjects = ['events.esign.>'];

      await broker.ensureStream(streamName, subjects);

      expect(mockJsm.streams.add).toHaveBeenCalledWith({
        name: streamName,
        subjects,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        `Ensured JetStream '${streamName}' exists for subjects: events.esign.>`
      );
    });

    it('should catch stream addition errors and log warning', async () => {
      mockJsm.streams.add.mockRejectedValueOnce(new Error('Stream name in use'));

      await broker.ensureStream('EXISTING_STREAM', ['events.>']);

      expect(logger.warn).toHaveBeenCalledWith(
        'Stream check warning (might already exist): Stream name in use'
      );
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      await broker.connect();
    });

    it('should encode payload as JSON and publish to target subject', async () => {
      const subject = 'events.esign.compliance.document.signed';
      const payload = { documentId: '123e4567-e89b-12d3-a456-426614174000' };
      const correlationId = 'cid_1002';

      await broker.publish(subject, payload, correlationId);

      expect(mockJs.publish).toHaveBeenCalledTimes(1);
      const [pubSubject, pubPayload] = mockJs.publish.mock.calls[0];

      expect(pubSubject).toBe(subject);
      expect(new TextDecoder().decode(pubPayload)).toBe(JSON.stringify(payload));
      expect(logger.debug).toHaveBeenCalledWith(
        `Published event to ${subject}`,
        correlationId
      );
    });

    it('should log and rethrow when publishing fails', async () => {
      const error = new Error('Publish timeout');
      mockJs.publish.mockRejectedValueOnce(error);

      await expect(
        broker.publish('events.test', { foo: 'bar' }, 'cid_err')
      ).rejects.toThrow('Publish timeout');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish to events.test: Publish timeout',
        'cid_err'
      );
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      await broker.connect();
    });

    it('should use existing consumer if found', async () => {
      mockJs.consumers.get.mockResolvedValueOnce(mockConsumer);
      mockConsumer.consume.mockResolvedValueOnce((async function* () {})());

      await broker.subscribe(
        'ESIGN_EVENTS',
        'compliance-service',
        async () => {}
      );

      expect(mockJs.consumers.get).toHaveBeenCalledWith(
        'ESIGN_EVENTS',
        'compliance-service'
      );
      expect(mockJsm.consumers.add).not.toHaveBeenCalled();
    });

    it('should create new consumer if existing consumer is not found', async () => {
      mockJs.consumers.get
        .mockRejectedValueOnce(new Error('Consumer not found'))
        .mockResolvedValueOnce(mockConsumer);
      mockConsumer.consume.mockResolvedValueOnce((async function* () {})());

      await broker.subscribe(
        'ESIGN_EVENTS',
        'compliance-service',
        async () => {},
        'events.esign.compliance.document.signed'
      );

      expect(mockJsm.consumers.add).toHaveBeenCalledWith('ESIGN_EVENTS', {
        durable_name: 'compliance-service',
        filter_subject: 'events.esign.compliance.document.signed',
        ack_policy: 'explicit',
      });
      expect(mockJs.consumers.get).toHaveBeenCalledTimes(2);
    });

    it('should pass parsed message payload to handler and execute ack on success', async () => {
      const mockMsg = {
        subject: 'events.esign.compliance.document.signed',
        json: vi.fn().mockReturnValue({ documentId: 'doc_123' }),
        ack: vi.fn(),
        nak: vi.fn(),
      };

      async function* singleMessageGenerator() {
        yield mockMsg;
      }

      mockJs.consumers.get.mockResolvedValueOnce(mockConsumer);
      mockConsumer.consume.mockResolvedValueOnce(singleMessageGenerator());

      const handler = vi.fn().mockImplementation(async (_payload, ack) => {
        ack();
      });

      await broker.subscribe('ESIGN_EVENTS', 'compliance-service', handler);

      // Give async consumer processing loop tick to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith({ documentId: 'doc_123' }, expect.any(Function));
      expect(mockMsg.ack).toHaveBeenCalledTimes(1);
      expect(mockMsg.nak).not.toHaveBeenCalled();
    });

    it('should nak message and log error if message handling fails', async () => {
      const mockMsg = {
        subject: 'events.esign.compliance.document.signed',
        json: vi.fn().mockReturnValue({ documentId: 'doc_corrupt' }),
        ack: vi.fn(),
        nak: vi.fn(),
      };

      async function* singleMessageGenerator() {
        yield mockMsg;
      }

      mockJs.consumers.get.mockResolvedValueOnce(mockConsumer);
      mockConsumer.consume.mockResolvedValueOnce(singleMessageGenerator());

      const handler = vi.fn().mockRejectedValue(new Error('Validation failed'));

      await broker.subscribe('ESIGN_EVENTS', 'compliance-service', handler);

      // Give async consumer processing loop tick to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockMsg.ack).not.toHaveBeenCalled();
      expect(mockMsg.nak).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing event on events.esign.compliance.document.signed: Validation failed'
      );
    });
  });
});