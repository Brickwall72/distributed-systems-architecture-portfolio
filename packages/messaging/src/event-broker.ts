// File: packages/messaging/src/event-broker.ts
import { connect, NatsConnection, TimeoutError, NoRespondersError } from '@nats-io/transport-node';
import { 
  jetstream, 
  jetstreamManager, 
  JetStreamClient, 
  JetStreamManager,
  JetStreamApiError,
  JetStreamApiCodes,
  AckPolicy,
  DeliverPolicy,
  RetentionPolicy,
  Consumer
} from '@nats-io/jetstream';
import { CloudEvent } from '@contracts/common';
import {
  beginOperation,
  diagnosticId,
  getDiagnosticContext,
  runInNewDiagnosticContext,
  runWithDiagnosticContext,
  safeErrorMetadata,
  validDiagnosticId,
  type DiagnosticContext,
  type Logger as DiagnosticLogger,
} from '@shared/diagnostics';
import type { NatsCredentials } from './credentials';
import {
  CORRELATION_HEADER, OPERATION_HEADER, PARENT_OPERATION_HEADER,
  diagnosticHeaders, eventMetadata, headerId, noopLogger, requestFailureCode,
} from './diagnostics';

/**
 * Structural logging contract required by EventBroker.
 */
export interface Logger extends DiagnosticLogger {}

export class EventBroker {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private jsm!: JetStreamManager;

  constructor(private readonly natsUrl: string, readonly logger?: Logger, private readonly credentials?: NatsCredentials) {
    if (!natsUrl) {
      throw new Error('EventBroker initialization failed: NATS URL is required but was undefined or empty.');
    }
  }

  /**
   * Establishes TCP connection with exponential reconnect policy and initializes JetStream context.
   */
  async connect() {
    this.logger?.info('Attempting connection to NATS Broker');
    
    this.nc = await connect({ 
      servers: this.natsUrl,
      ...this.credentials,
      maxReconnectAttempts: 10,
      reconnectTimeWait: 2000,
      waitOnFirstConnect: true,
    });

    this.js = jetstream(this.nc);
    this.jsm = await jetstreamManager(this.nc);
    this.logger?.info('Successfully connected to NATS Broker');
  }

  /**
   * Gracefully closes the underlying NATS connection.
   */
  async disconnect() {
    if (this.nc) {
      await this.nc.close();
      this.logger?.info('Disconnected from NATS Broker');
    }
  }

  async flush(): Promise<void> {
    await this.nc.flush();
  }

  /** Create the publisher-owned stream or verify its existing subject configuration. */
  async ensureStream(streamName: string, subjects: string[]) {
    try {
      let existing;
      try {
        existing = await this.jsm.streams.info(streamName);
      } catch (error) {
        if (!(error instanceof JetStreamApiError) || error.code !== JetStreamApiCodes.StreamNotFound) throw error;
        existing = await this.jsm.streams.add({ name: streamName, subjects });
      }
      const actual = existing.config.subjects ?? [];
      if (actual.length !== subjects.length || subjects.some((subject) => !actual.includes(subject))
        || existing.config.retention !== RetentionPolicy.Limits) {
        throw new Error(`Stream '${streamName}' has unexpected subjects or retention policy`);
      }
    } catch (err) {
      this.logger?.error('Failed to ensure NATS stream', undefined, safeErrorMetadata(err));
      throw err;
    }
  }

  async waitForStream(streamName: string, subjects: string[], signal?: AbortSignal): Promise<void> {
    const wait = async (): Promise<void> => {
      signal?.throwIfAborted();
      try {
        const info = await this.jsm.streams.info(streamName);
        const actual = info.config.subjects ?? [];
        if (actual.length !== subjects.length || subjects.some((subject) => !actual.includes(subject))
          || info.config.retention !== RetentionPolicy.Limits) {
          throw new Error(`Stream '${streamName}' has unexpected subjects or retention policy`);
        }
        signal?.throwIfAborted();
        return;
      } catch (error) {
        if (!(error instanceof TimeoutError) && !(error instanceof NoRespondersError)
          && (!(error instanceof JetStreamApiError) || error.code !== JetStreamApiCodes.StreamNotFound)) throw error;
        this.logger?.warn(`Waiting for publisher-owned stream '${streamName}'`);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 5000);
          const abort = () => { clearTimeout(timeout); reject(signal?.reason); };
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) abort();
        });
        return wait();
      }
    };
    return wait();
  }

  /**
   * Sends a request to a target subject and awaits a reply (NATS Request-Reply pattern).
   */
  async request<TResponse = unknown>(
    subject: string,
    payload: unknown,
    options: { timeout?: number; correlationId?: string | null } = {}
  ): Promise<TResponse> {
    const { timeout = 10000, correlationId: explicitCorrelationId } = options;
    const activeContext = getDiagnosticContext();
    const correlationId = validDiagnosticId(explicitCorrelationId)
      ? explicitCorrelationId
      : diagnosticId(activeContext?.correlationId);
    return runWithDiagnosticContext({
      correlationId,
      ...(activeContext?.operation ? { operation: activeContext.operation } : {}),
      ...(activeContext?.operationId ? { operationId: activeContext.operationId } : {}),
      ...(activeContext?.parentOperationId ? { parentOperationId: activeContext.parentOperationId } : {}),
    }, async () => {
      const operation = beginOperation(this.logger ?? noopLogger, 'nats.request', { subject });
      return runWithDiagnosticContext(operation.context, async () => {
        try {
          const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
          const requestHeaders = diagnosticHeaders(operation.context);
          if (activeContext?.operationId) requestHeaders.set(PARENT_OPERATION_HEADER, activeContext.operationId);

          const responseMsg = await this.nc.request(subject, encodedPayload, { timeout, headers: requestHeaders });
          const decodedResponse = JSON.parse(new TextDecoder().decode(responseMsg.data));
          operation.finish('reply_received');
          return decodedResponse as TResponse;
        } catch (error: unknown) {
          const failure = requestFailureCode(error);
          operation.finish(failure.outcome, { errorCode: failure.code, ...safeErrorMetadata(error) });
          throw error;
        }
      });
    });
  }

  /**
   * Sets up a responder for incoming NATS request-reply calls.
   */
  respond(
    subject: string,
    handler: (payload: any) => Promise<unknown>,
    options: { queue?: string } = {}
  ): void {
    const subscription = this.nc.subscribe(subject, options.queue ? { queue: options.queue } : undefined);
    this.logger?.info('Listening for NATS requests', undefined, { subject });

    void (async () => {
      for await (const msg of subscription) {
        const correlationId = diagnosticId(headerId(msg.headers, CORRELATION_HEADER));
        const callerOperationId = headerId(msg.headers, OPERATION_HEADER);
        const deliveryContext: DiagnosticContext = {
          correlationId,
          ...(callerOperationId ? { operationId: callerOperationId } : {}),
        };
        await runWithDiagnosticContext(deliveryContext, async () => {
          const operation = beginOperation(this.logger ?? noopLogger, 'nats.responder', { subject: msg.subject });
          await runWithDiagnosticContext(operation.context, async () => {
            try {
              const payload = JSON.parse(new TextDecoder().decode(msg.data));
              const result = await handler(payload);

              if (!msg.reply) {
                operation.finish('discarded', { errorCode: 'missing_reply_subject' });
                return;
              }
              const sent = msg.respond(new TextEncoder().encode(JSON.stringify(result)), {
                headers: diagnosticHeaders(operation.context),
              });
              if (!sent) {
                operation.finish('failure', { errorCode: 'reply_rejected' });
                return;
              }
              operation.finish('reply_sent');
            } catch (error: unknown) {
              let replySent = false;
              if (msg.reply) {
                const errorReply = new TextEncoder().encode(
                  JSON.stringify({ error: (error as Error).message }),
                );
                replySent = msg.respond(errorReply, { headers: diagnosticHeaders(operation.context) });
                if (replySent) {
                  this.logger?.debug('NATS error reply sent', undefined, { subject: msg.subject, outcome: 'reply_sent' });
                }
              }
              operation.finish('failure', {
                errorCode: error instanceof SyntaxError ? 'invalid_request' : 'handler_failed',
                ...safeErrorMetadata(error),
                ...(msg.reply && !replySent ? { errorCode: 'reply_rejected' } : {}),
              });
            }
          });
        });
      }
    })();
  }

  /**
   * Publishes an event payload to a target subject using native TextEncoder serialization.
   */
  async publish(subject: string, payload: CloudEvent<unknown>) {
    const metadata = { subject, ...eventMetadata(payload) };
    return runInNewDiagnosticContext(async () => {
      const localCorrelationId = getDiagnosticContext()!.correlationId;
      try {
        const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
        await this.js.publish(subject, encodedPayload);
        this.logger?.debug('Published NATS event', localCorrelationId, metadata);
      } catch (error: unknown) {
        this.logger?.error('Failed to publish NATS event', localCorrelationId, {
          ...metadata, ...safeErrorMetadata(error),
        });
        throw error;
      }
    });
  }

  /**
   * Subscribes to a JetStream stream using a durable consumer.
   * 
   * @param streamName The JetStream stream identifier (e.g., 'ESIGN_EVENTS')
   * @param durableName The durable consumer identifier (e.g., 'compliance-service')
   * @param handler Message handler callback
   * @param filterSubject Optional subject filter (e.g., 'events.esign.compliance.document.signed')
   * @param options.nakDelayMs Optional redelivery delay applied when the handler throws
   */
  async subscribe(
    streamName: string,
    durableName: string,
    handler: (payload: any, ack: () => void) => Promise<void>,
    filterSubject?: string,
    options: { nakDelayMs?: number } = {}
  ) {
    let consumer: Consumer;

    try {
      await this.jsm.consumers.info(streamName, durableName);
    } catch (error) {
      if (!(error instanceof JetStreamApiError) || error.code !== JetStreamApiCodes.ConsumerNotFound) throw error;
      await this.jsm.consumers.add(streamName, {
        durable_name: durableName,
        filter_subject: filterSubject,
        ack_policy: AckPolicy.Explicit,
      });
    }
    consumer = await this.js.consumers.get(streamName, durableName);
    const info = await consumer.info(true);
    if (info.config.filter_subject !== filterSubject || info.config.ack_policy !== AckPolicy.Explicit
      || info.config.deliver_policy !== DeliverPolicy.All) {
      throw new Error(`Consumer '${durableName}' has an unexpected configuration`);
    }

    const messages = await consumer.consume();
    this.logger?.info(`Subscribed to stream '${streamName}' as durable consumer '${durableName}'`);

    void (async () => {
      try {
        for await (const msg of messages) {
          await runInNewDiagnosticContext(async () => {
            let payload: unknown;
            try {
              payload = msg.json();
              await handler(payload, () => msg.ack());
            } catch (error: unknown) {
              this.logger?.error('Error processing NATS event', undefined, {
                subject: msg.subject,
                ...eventMetadata(payload),
                ...safeErrorMetadata(error),
              });
              msg.nak(options.nakDelayMs);
            }
          });
        }
      } catch (streamErr) {
        this.logger?.error('Fatal NATS stream iterator error', undefined, safeErrorMetadata(streamErr));
      }
    })();
  }
}