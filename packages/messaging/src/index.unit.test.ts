// File: packages/messaging/src/index.unit.test.ts
import { EventBroker, Logger, natsCredentialsFromEnv } from './index.js';
import { createCloudEventSchema, type CloudEvent } from '@contracts/common';
import { z } from 'zod';
import { zocker } from 'zocker';
import { JetStreamApiError, JetStreamApiCodes } from '@nats-io/jetstream';
import { headers, NoRespondersError, TimeoutError } from '@nats-io/transport-node';
import {
  getDiagnosticContext,
  runWithDiagnosticContext,
} from '@shared/diagnostics';
import {
  createLogger as createExpressLogger,
  runWithDiagnosticContext as runWithExpressDiagnosticContext,
} from '@shared/express';

const eventSchema = createCloudEventSchema(z.object({ documentId: z.string().uuid() }));
const mockEvent = (overrides: Partial<CloudEvent<{ documentId: string }>> = {}): CloudEvent<{ documentId: string }> =>
  eventSchema.parse({ ...zocker(eventSchema).generate(), ...overrides });

// Mocks for NATS transport and JetStream
const mockNc = {
  close: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
  request: vi.fn(),
};

const mockConsumer = {
  consume: vi.fn(),
  info: vi.fn(),
};

const mockJs = {
  publish: vi.fn().mockResolvedValue({ stream: 'TEST', seq: 1 }),
  consumers: {
    get: vi.fn(),
  },
};

const mockJsm = {
  streams: {
    info: vi.fn(),
    add: vi.fn(),
    update: vi.fn().mockResolvedValue({ name: 'TEST_STREAM' }),
  },
  consumers: {
    info: vi.fn(),
    add: vi.fn().mockResolvedValue({ name: 'TEST_CONSUMER' }),
  },
};

vi.mock('@nats-io/transport-node', async (importOriginal) => ({
  ...await importOriginal<typeof import('@nats-io/transport-node')>(),
  connect: vi.fn(() => Promise.resolve(mockNc)),
}));

vi.mock('@nats-io/jetstream', async (importOriginal) => ({
  ...await importOriginal<typeof import('@nats-io/jetstream')>(),
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
    mockJsm.streams.info.mockReset();
    mockJsm.streams.add.mockReset().mockImplementation(async (config) => ({ config: { ...config, retention: 'limits' } }));
    mockJsm.streams.info.mockRejectedValue(new JetStreamApiError({
      code: 404, err_code: JetStreamApiCodes.StreamNotFound, description: 'stream not found',
    }));
    mockJsm.consumers.info.mockReset().mockResolvedValue({});
    mockJs.consumers.get.mockReset().mockResolvedValue(mockConsumer);
    mockConsumer.info.mockReset().mockResolvedValue({ config: { filter_subject: undefined, ack_policy: 'explicit', deliver_policy: 'all' } });
    mockConsumer.consume.mockReset().mockImplementation(() => (async function* () {})());

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    broker = new EventBroker(natsUrl, logger);
  });

  describe('natsCredentialsFromEnv', () => {
    it('uses a per-service inbox prefix when credentials are present', () => {
      expect(natsCredentialsFromEnv({ NATS_USER: 'compliance', NATS_PASSWORD: 'secret' }))
        .toEqual({ user: 'compliance', pass: 'secret', inboxPrefix: '_INBOX.compliance' });
    });

    it('does not silently accept partial or malformed credentials', () => {
      expect(natsCredentialsFromEnv({})).toBeUndefined();
      expect(() => natsCredentialsFromEnv({ NATS_USER: 'compliance' })).toThrow();
      expect(() => natsCredentialsFromEnv({ NATS_USER: 'bad.>', NATS_PASSWORD: 'secret' })).toThrow();
    });
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
        'Attempting connection to NATS Broker'
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully connected to NATS Broker'
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

    describe('respond', () => {
      it('uses a queue group when one is provided', async () => {
        mockNc.subscribe.mockReturnValueOnce((async function* () {})());
        await broker.connect();

        broker.respond('requests.topology.transfer.reserve', async () => ({ status: 'OK' }), {
          queue: 'topology-reservations',
        });

        expect(mockNc.subscribe).toHaveBeenCalledWith(
          'requests.topology.transfer.reserve',
          { queue: 'topology-reservations' },
        );
      });

      it('keeps existing responders outside a queue group by default', async () => {
        mockNc.subscribe.mockReturnValueOnce((async function* () {})());
        await broker.connect();

        broker.respond('requests.pdf.generate', async () => ({ success: true }));

        expect(mockNc.subscribe).toHaveBeenCalledWith('requests.pdf.generate', undefined);
      });

      it('validates request headers, creates an isolated operation, and returns diagnostic headers', async () => {
        await broker.connect();
        const requestHeaders = headers();
        requestHeaders.set('x-correlation-id', 'bad id');
        requestHeaders.append('x-correlation-id', 'duplicate-id');
        requestHeaders.set('x-operation-id', 'bad operation');
        const responseHeaders = headers();
        let finishDelivery!: () => void;
        const holdDelivery = new Promise<void>((resolve) => { finishDelivery = resolve; });
        let resolveReply!: () => void;
        const replyDelivered = new Promise<void>((resolve) => { resolveReply = resolve; });
        let resolveContext!: (context: ReturnType<typeof getDiagnosticContext>) => void;
        const receivedContext = new Promise<ReturnType<typeof getDiagnosticContext>>((resolve) => {
          resolveContext = resolve;
        });
        mockNc.subscribe.mockReturnValueOnce((async function* () {
          yield {
            subject: 'requests.test',
            reply: '_INBOX.reply',
            data: new TextEncoder().encode(JSON.stringify({ value: 'unchanged' })),
            headers: requestHeaders,
            respond: vi.fn().mockImplementation((_data, options) => {
              for (const [key, values] of options.headers) {
                for (const value of values) responseHeaders.append(key, value);
              }
              resolveReply();
              return true;
            }),
          };
          await holdDelivery;
        })());
        runWithDiagnosticContext({ correlationId: 'registration-cid', operationId: 'registration-op' }, () => {
          broker.respond('requests.test', async (payload) => {
            expect(payload).toEqual({ value: 'unchanged' });
            const context = getDiagnosticContext();
            expect(context?.correlationId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
            expect(context?.correlationId).not.toBe('registration-cid');
            expect(context?.parentOperationId).toBeUndefined();
            resolveContext(context);
            return { result: 'ok' };
          });
        });
        const context = await receivedContext;
        await replyDelivered;
        finishDelivery();
        expect(context?.correlationId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
        expect(context?.correlationId).not.toBe('registration-cid');
        expect(context?.parentOperationId).toBeUndefined();
        expect(responseHeaders.get('x-correlation-id')).toBe(context?.correlationId);
        expect(responseHeaders.get('x-operation-id')).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
        expect(responseHeaders.get('x-parent-operation-id')).toBe('');
      });

      it('links each responder delivery to the request operation and isolates deliveries', async () => {
        await broker.connect();
        const deliveries = [
          { correlationId: 'request-cid-1', operationId: 'request-op-1' },
          { correlationId: 'request-cid-2', operationId: 'request-op-2' },
        ];
        const contexts: Array<NonNullable<ReturnType<typeof getDiagnosticContext>>> = [];
        let finishDelivery!: () => void;
        const holdDelivery = new Promise<void>((resolve) => { finishDelivery = resolve; });
        mockNc.subscribe.mockReturnValueOnce((async function* () {
          for (const delivery of deliveries) {
            const messageHeaders = headers();
            messageHeaders.set('x-correlation-id', delivery.correlationId);
            messageHeaders.set('x-operation-id', delivery.operationId);
            yield {
              subject: 'requests.test',
              reply: '_INBOX.reply',
              data: new TextEncoder().encode('{}'),
              headers: messageHeaders,
              respond: vi.fn().mockReturnValue(true),
            };
          }
          await holdDelivery;
        })());
        let handled!: () => void;
        const handledTwice = new Promise<void>((resolve) => { handled = resolve; });
        let count = 0;
        runWithDiagnosticContext({ correlationId: 'registration-cid', operationId: 'registration-op' }, () => {
          broker.respond('requests.test', async () => {
            contexts.push(getDiagnosticContext()!);
            count++;
            if (count === deliveries.length) handled();
            return {};
          });
        });
        await handledTwice;
        finishDelivery();
        expect(contexts.map((context) => context.correlationId)).toEqual(deliveries.map((item) => item.correlationId));
        expect(contexts.map((context) => context.parentOperationId)).toEqual(deliveries.map((item) => item.operationId));
        expect(contexts[0].operationId).not.toBe(contexts[1].operationId);
      });

      it('logs a rejected reply publication without changing the handler result path', async () => {
        await broker.connect();
        const reply = vi.fn().mockReturnValue(false);
        let finishDelivery!: () => void;
        const holdDelivery = new Promise<void>((resolve) => { finishDelivery = resolve; });
        mockNc.subscribe.mockReturnValueOnce((async function* () {
          yield {
            subject: 'requests.test',
            reply: '_INBOX.reply',
            data: new TextEncoder().encode('{}'),
            headers: undefined,
            respond: reply,
          };
          await holdDelivery;
        })());
        let handled!: () => void;
        const handlerFinished = new Promise<void>((resolve) => { handled = resolve; });
        runWithDiagnosticContext({ correlationId: 'registration-cid' }, () => {
          broker.respond('requests.test', async () => {
            handled();
            return { accepted: true };
          });
        });
        await handlerFinished;
        await new Promise((resolve) => setTimeout(resolve, 0));
        finishDelivery();
        expect(reply).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith('Concluded nats.responder: failure', undefined,
          expect.objectContaining({ subject: 'requests.test', outcome: 'failure', errorCode: 'reply_rejected' }));
      });

      it('preserves the error reply envelope while keeping handler details out of logs', async () => {
        await broker.connect();
        let replySent!: () => void;
        const replyDelivered = new Promise<void>((resolve) => { replySent = resolve; });
        const reply = vi.fn().mockImplementation(() => {
          replySent();
          return true;
        });
        let finishDelivery!: () => void;
        const holdDelivery = new Promise<void>((resolve) => { finishDelivery = resolve; });
        mockNc.subscribe.mockReturnValueOnce((async function* () {
          yield {
            subject: 'requests.test',
            reply: '_INBOX.reply',
            data: new TextEncoder().encode('{}'),
            headers: undefined,
            respond: reply,
          };
          await holdDelivery;
        })());
        runWithDiagnosticContext({ correlationId: 'registration-cid' }, () => {
          broker.respond('requests.test', async () => {
            throw new Error('private handler detail');
          });
        });
        await replyDelivered;
        finishDelivery();
        const [response] = reply.mock.calls;
        expect(JSON.parse(new TextDecoder().decode(response[0]))).toEqual({ error: 'private handler detail' });
        expect(logger.error).toHaveBeenCalledWith('Concluded nats.responder: failure', undefined,
          expect.objectContaining({ errorCode: 'handler_failed', errorType: 'Error' }));
        const errorLogger = logger.error as unknown as ReturnType<typeof vi.fn>;
        expect(errorLogger.mock.calls.flat().join(' ')).not.toContain('private handler detail');
      });
    });

    describe('request diagnostics', () => {
      beforeEach(async () => {
        await broker.connect();
        mockNc.request.mockReset();
      });

      it('sends the active correlation and request-operation linkage without changing the payload', async () => {
        mockNc.request.mockResolvedValueOnce({ data: new TextEncoder().encode('{"ok":true}') });
        const payload = { data: 'business payload' };
        await runWithDiagnosticContext({
          correlationId: 'http-cid',
          operation: 'http.request',
          operationId: 'http-op',
        }, async () => {
          await expect(broker.request('requests.test', payload)).resolves.toEqual({ ok: true });
        });

        const [subject, encodedPayload, options] = mockNc.request.mock.calls[0];
        expect(subject).toBe('requests.test');
        expect(new TextDecoder().decode(encodedPayload)).toBe(JSON.stringify(payload));
        expect(options.timeout).toBe(10000);
        expect(options.headers.get('x-correlation-id')).toBe('http-cid');
        expect(options.headers.get('x-operation-id')).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
        expect(options.headers.get('x-parent-operation-id')).toBe('http-op');
        expect(logger.info).toHaveBeenCalledWith('Concluded nats.request: reply_received', undefined,
          expect.objectContaining({ subject: 'requests.test', phase: 'end', outcome: 'reply_received' }));
      });

      it.each([
        [new TimeoutError(), 'timeout', 'warn'],
        [new NoRespondersError('requests.test'), 'no_responders', 'warn'],
      ] as const)('logs safe request failure metadata for %s', async (error, errorCode, level) => {
        mockNc.request.mockRejectedValueOnce(error);
        await expect(broker.request('requests.test', {})).rejects.toBe(error);
        const method = logger[level] as unknown as ReturnType<typeof vi.fn>;
        expect(method).toHaveBeenCalledWith('Concluded nats.request: rejected', undefined,
          expect.objectContaining({ subject: 'requests.test', errorCode, phase: 'end' }));
        expect(method.mock.calls.flat().join(' ')).not.toContain(error.message);
      });

      it('reports malformed JSON replies as decode failures and rethrows the original parse error', async () => {
        mockNc.request.mockResolvedValueOnce({ data: new TextEncoder().encode('not-json') });
        let parseError: unknown;
        try {
          await broker.request('requests.test', {});
        } catch (error) {
          parseError = error;
        }
        expect(parseError).toBeInstanceOf(SyntaxError);
        expect(logger.error).toHaveBeenCalledWith('Concluded nats.request: failure', undefined,
          expect.objectContaining({ subject: 'requests.test', phase: 'end', errorCode: 'invalid_reply', errorType: 'SyntaxError' }));
        const errorLogger = logger.error as unknown as ReturnType<typeof vi.fn>;
        expect(errorLogger.mock.calls.flat().join(' ')).not.toContain((parseError as Error).message);
      });

      it('uses a valid explicit ID or generates one for a standalone request', async () => {
        mockNc.request
          .mockResolvedValueOnce({ data: new TextEncoder().encode('{}') })
          .mockResolvedValueOnce({ data: new TextEncoder().encode('{}') })
          .mockResolvedValueOnce({ data: new TextEncoder().encode('{}') });
        await broker.request('requests.explicit', {}, { correlationId: 'explicit-cid' });
        await runWithDiagnosticContext({ correlationId: 'active-cid' }, () =>
          broker.request('requests.invalid-explicit', {}, { correlationId: 'invalid id' }));
        await broker.request('requests.standalone', {});
        const explicitHeaders = mockNc.request.mock.calls[0][2].headers;
        const invalidExplicitHeaders = mockNc.request.mock.calls[1][2].headers;
        const standaloneHeaders = mockNc.request.mock.calls[2][2].headers;
        expect(explicitHeaders.get('x-correlation-id')).toBe('explicit-cid');
        expect(invalidExplicitHeaders.get('x-correlation-id')).toBe('active-cid');
        expect(standaloneHeaders.get('x-correlation-id')).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
        expect(standaloneHeaders.get('x-correlation-id')).not.toBe('explicit-cid');
      });
    });

    it('isolates JetStream deliveries and does not restore event correlation as local context', async () => {
      const eventPayloads = [
        { id: 'event-1', correlationId: 'stored-cid-1' },
        { id: 'event-2', correlationId: 'stored-cid-2' },
      ];
      const contexts: Array<NonNullable<ReturnType<typeof getDiagnosticContext>>> = [];
      let finishDelivery!: () => void;
      const holdDelivery = new Promise<void>((resolve) => { finishDelivery = resolve; });
      mockConsumer.consume.mockReset().mockResolvedValueOnce((async function* () {
        for (const payload of eventPayloads) {
          yield { subject: 'events.test', json: () => payload, ack: vi.fn(), nak: vi.fn() };
        }
        await holdDelivery;
      })());
      let handled!: () => void;
      const handledBoth = new Promise<void>((resolve) => { handled = resolve; });
      runWithDiagnosticContext({ correlationId: 'registration-cid', operationId: 'registration-op' }, async () => {
        await broker.subscribe('EVENTS', 'test-consumer', async () => {
          contexts.push(getDiagnosticContext()!);
          if (contexts.length === eventPayloads.length) handled();
        });
      });
      await handledBoth;
      finishDelivery();
      expect(contexts).toHaveLength(2);
      expect(contexts[0].correlationId).not.toBe('registration-cid');
      expect(contexts[0].correlationId).not.toBe('stored-cid-1');
      expect(contexts[0].correlationId).not.toBe('stored-cid-2');
      expect(contexts[0].correlationId).not.toBe(contexts[1].correlationId);
      expect(contexts.map((context) => context.parentOperationId)).toEqual([undefined, undefined]);
    });

    it('shares the built Express logger context with the messaging package', async () => {
      const expressLogger = createExpressLogger('express-interop');
      const brokerLogger = createExpressLogger('messaging-interop');
      const integratedBroker = new EventBroker(natsUrl, brokerLogger);
      await integratedBroker.connect();
      mockNc.request.mockResolvedValueOnce({ data: new TextEncoder().encode('{"ok":true}') });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await runWithExpressDiagnosticContext({
          correlationId: 'shared-context-cid',
          operation: 'http.request',
          operationId: 'http-parent-op',
        }, async () => {
          expressLogger.info('HTTP context is active');
          await integratedBroker.request('requests.interop', {});
        });
        const logs = logSpy.mock.calls.map(([line]) => JSON.parse(String(line)));
        const httpLog = logs.find((line) => line.message === 'HTTP context is active');
        const requestStart = logs.find((line) => line.operation === 'nats.request' && line.phase === 'start');
        expect(httpLog.correlationId).toBe('shared-context-cid');
        expect(requestStart.correlationId).toBe('shared-context-cid');
        expect(requestStart.parentOperationId).toBe('http-parent-op');
        expect(mockNc.request.mock.calls.at(-1)?.[2].headers.get('x-correlation-id')).toBe('shared-context-cid');
      } finally {
        logSpy.mockRestore();
      }
    });

    it('should add a stream via JetStream manager when it does not exist', async () => {
      const streamName = 'ESIGN_EVENTS';
      const subjects = ['events.esign.>'];

      await broker.ensureStream(streamName, subjects);

      expect(mockJsm.streams.add).toHaveBeenCalledWith({
        name: streamName,
        subjects,
      });
      expect(mockJsm.streams.update).not.toHaveBeenCalled();
    });

    it('rejects incompatible subjects without updating the stream', async () => {
      const config = { name: 'ESIGN_EVENTS', subjects: ['events.esign.a', 'events.esign.b'], retention: 'limits' };
      mockJsm.streams.info.mockResolvedValueOnce({ config });

      await expect(broker.ensureStream('ESIGN_EVENTS', ['events.esign.b', 'events.esign.c'])).rejects.toThrow('unexpected subjects');

      expect(mockJsm.streams.add).not.toHaveBeenCalled();
      expect(mockJsm.streams.update).not.toHaveBeenCalled();
    });

    it('does not update an existing stream when all subjects are present', async () => {
      mockJsm.streams.info.mockResolvedValueOnce({ config: { subjects: ['events.example.>'], retention: 'limits' } });
      await broker.ensureStream('EXAMPLE', ['events.example.>']);
      expect(mockJsm.streams.update).not.toHaveBeenCalled();
    });

    it('propagates authenticated stream permission failures', async () => {
      const secured = new EventBroker(natsUrl, logger, natsCredentialsFromEnv({
        NATS_USER: 'compliance', NATS_PASSWORD: 'secret',
      }));
      await secured.connect();
      mockJsm.streams.info.mockResolvedValueOnce({ config: { subjects: ['events.example.>'], retention: 'limits' } });
      await secured.ensureStream('EXAMPLE', ['events.example.>']);
      expect(mockJsm.streams.add).not.toHaveBeenCalled();
      expect(mockJsm.streams.update).not.toHaveBeenCalled();
      mockJsm.streams.info.mockRejectedValueOnce(new Error('permission denied'));
      await expect(secured.ensureStream('EXAMPLE', ['events.example.>'])).rejects.toThrow('permission denied');
      expect(mockJsm.streams.add).not.toHaveBeenCalled();
    });

    it('should log and rethrow stream addition errors', async () => {
      mockJsm.streams.add.mockRejectedValueOnce(new Error('Stream name in use'));

      await expect(broker.ensureStream('EXISTING_STREAM', ['events.>'])).rejects.toThrow('Stream name in use');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to ensure NATS stream',
        undefined,
        { errorType: 'Error' },
      );
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      await broker.connect();
    });

    it('should encode payload as JSON and publish to target subject', async () => {
      const subject = 'events.esign.compliance.document.signed';
      const payload = mockEvent({ type: subject, correlationId: 'cid_1002' });
      const correlationId = payload.correlationId;

      await broker.publish(subject, payload);

      expect(mockJs.publish).toHaveBeenCalledTimes(1);
      const [pubSubject, pubPayload] = mockJs.publish.mock.calls[0];

      expect(pubSubject).toBe(subject);
      expect(new TextDecoder().decode(pubPayload)).toBe(JSON.stringify(payload));
      expect(logger.debug).toHaveBeenCalledWith(
        'Published NATS event',
        expect.stringMatching(/^[A-Za-z0-9._:-]{1,128}$/),
        { subject, eventCorrelationId: correlationId, eventId: payload.id },
      );
    });

    it('should log and rethrow when publishing fails', async () => {
      const error = new Error('Publish timeout');
      mockJs.publish.mockRejectedValueOnce(error);

      await expect(
        broker.publish('events.test', mockEvent({ correlationId: 'cid_err' }))
      ).rejects.toThrow('Publish timeout');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish NATS event',
        expect.stringMatching(/^[A-Za-z0-9._:-]{1,128}$/),
        expect.objectContaining({ subject: 'events.test', eventCorrelationId: 'cid_err', errorType: 'Error' }),
      );
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      await broker.connect();
    });

    it('requires an authenticated consumer with the expected filter and acknowledgment policy', async () => {
      const secured = new EventBroker(natsUrl, logger, natsCredentialsFromEnv({
        NATS_USER: 'audit', NATS_PASSWORD: 'secret',
      }));
      await secured.connect();
      mockJs.consumers.get.mockResolvedValue(mockConsumer);
      mockConsumer.info.mockResolvedValueOnce({ config: { filter_subject: 'events.other', ack_policy: 'explicit', deliver_policy: 'all' } });
      await expect(secured.subscribe('EVENTS', 'audit-consumer', async () => {}, 'events.expected'))
        .rejects.toThrow('unexpected configuration');
      expect(mockJsm.consumers.add).not.toHaveBeenCalled();

      mockConsumer.info.mockResolvedValueOnce({ config: { filter_subject: 'events.expected', ack_policy: 'explicit', deliver_policy: 'all' } });
      mockConsumer.consume.mockResolvedValueOnce((async function* () {})());
      await secured.subscribe('EVENTS', 'audit-consumer', async () => {}, 'events.expected');
      expect(mockJsm.consumers.add).not.toHaveBeenCalled();
      mockJs.consumers.get.mockReset();
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
      mockJsm.consumers.info.mockRejectedValueOnce(new JetStreamApiError({
        code: 404, err_code: JetStreamApiCodes.ConsumerNotFound, description: 'consumer not found',
      }));
      mockConsumer.info.mockResolvedValueOnce({ config: {
        filter_subject: 'events.esign.compliance.document.signed', ack_policy: 'explicit', deliver_policy: 'all',
      } });
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
      expect(mockJs.consumers.get).toHaveBeenCalledTimes(1);
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
        'Error processing NATS event',
        undefined,
        expect.objectContaining({ subject: 'events.esign.compliance.document.signed', errorType: 'Error' }),
      );
    });

    it('should pass nakDelayMs to nak when provided', async () => {
      const mockMsg = {
        subject: 'events.esign.compliance.document.signed',
        json: vi.fn().mockReturnValue({}),
        ack: vi.fn(),
        nak: vi.fn(),
      };

      async function* singleMessageGenerator() {
        yield mockMsg;
      }

      mockJs.consumers.get.mockResolvedValueOnce(mockConsumer);
      mockConsumer.consume.mockResolvedValueOnce(singleMessageGenerator());

      const handler = vi.fn().mockRejectedValue(new Error('db down'));

      await broker.subscribe('ESIGN_EVENTS', 'audit-ledger', handler, undefined, { nakDelayMs: 5000 });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockMsg.nak).toHaveBeenCalledWith(5000);
    });
  });
});