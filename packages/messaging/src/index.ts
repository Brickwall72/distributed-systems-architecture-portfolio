// File: packages/messaging/src/index.ts
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

/**
 * Structural logging contract required by EventBroker.
 */
export interface Logger {
  info(message: string, correlationId?: string | null): void;
  warn(message: string, correlationId?: string | null): void;
  error(message: string, correlationId?: string | null): void;
  debug(message: string, correlationId?: string | null): void;
}

export interface NatsCredentials {
  user: string;
  pass: string;
  inboxPrefix: string;
}

export function natsCredentialsFromEnv(env: NodeJS.ProcessEnv): NatsCredentials | undefined {
  const { NATS_USER: user, NATS_PASSWORD: pass } = env;
  if (!user && !pass) return undefined;
  if (!user || !pass || !/^[a-zA-Z0-9_-]+$/.test(user)) {
    throw new Error('NATS_USER and NATS_PASSWORD must both be provided; the user must be a valid subject token');
  }
  return { user, pass, inboxPrefix: `_INBOX.${user}` };
}

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
    this.logger?.info(`Attempting connection to NATS Broker at ${this.natsUrl}`);
    
    this.nc = await connect({ 
      servers: this.natsUrl,
      ...this.credentials,
      maxReconnectAttempts: 10,
      reconnectTimeWait: 2000,
      waitOnFirstConnect: true,
    });

    this.js = jetstream(this.nc);
    this.jsm = await jetstreamManager(this.nc);
    this.logger?.info(`Successfully connected to NATS Broker at ${this.natsUrl}`);
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
      this.logger?.error(`Failed to ensure stream '${streamName}': ${(err as Error).message}`);
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
    const { timeout = 10000, correlationId = null } = options;
    try {
      const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
      this.logger?.debug(`Sending NATS request to ${subject}`, correlationId);

      const responseMsg = await this.nc.request(subject, encodedPayload, { timeout });
      const decodedResponse = JSON.parse(new TextDecoder().decode(responseMsg.data));

      this.logger?.debug(`Received NATS reply from ${subject}`, correlationId);
      return decodedResponse as TResponse;
    } catch (err) {
      this.logger?.error(`NATS request failed on ${subject}: ${(err as Error).message}`, correlationId);
      throw err;
    }
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
    this.logger?.info(`Listening for NATS requests on subject '${subject}'`);

    void (async () => {
      for await (const msg of subscription) {
        try {
          const payload = JSON.parse(new TextDecoder().decode(msg.data));
          const result = await handler(payload);
          
          if (msg.reply) {
            const encodedReply = new TextEncoder().encode(JSON.stringify(result));
            msg.respond(encodedReply);
          }
        } catch (err) {
          this.logger?.error(`Error handling request on ${msg.subject}: ${(err as Error).message}`);
          if (msg.reply) {
            const errorReply = new TextEncoder().encode(
              JSON.stringify({ error: (err as Error).message })
            );
            msg.respond(errorReply);
          }
        }
      }
    })();
  }

  /**
   * Publishes an event payload to a target subject using native TextEncoder serialization.
   */
  async publish(subject: string, payload: CloudEvent<unknown>) {
    try {
      const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
      await this.js.publish(subject, encodedPayload);
      this.logger?.debug(`Published event to ${subject}`, payload.correlationId);
    } catch (err) {
      this.logger?.error(`Failed to publish to ${subject}: ${(err as Error).message}`, payload.correlationId);
      throw err;
    }
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
          try {
            const payload = msg.json();
            await handler(payload, () => msg.ack());
          } catch (err) {
            this.logger?.error(`Error processing event on ${msg.subject}: ${(err as Error).message}`);
            msg.nak(options.nakDelayMs);
          }
        }
      } catch (streamErr) {
        this.logger?.error(`Fatal stream iterator error in messaging consumer loop: ${(streamErr as Error).message}`);
      }
    })();
  }
}