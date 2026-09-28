// File: packages/messaging/src/index.ts
import { connect, NatsConnection } from '@nats-io/transport-node';
import { 
  jetstream, 
  jetstreamManager, 
  JetStreamClient, 
  JetStreamManager 
} from '@nats-io/jetstream';

/**
 * Structural logging contract required by EventBroker.
 * Defined locally to avoid manifest-level dependencies on telemetry packages.
 */
export interface Logger {
  info(message: string, correlationId?: string | null): void;
  warn(message: string, correlationId?: string | null): void;
  error(message: string, correlationId?: string | null): void;
  debug(message: string, correlationId?: string | null): void;
}

type JetStreamClientWithSubscribe = JetStreamClient & {
  subscribe: (
    subject: string,
    opts?: { config?: { durable_name?: string } }
  ) => Promise<any>;
};

export class EventBroker {
  private nc!: NatsConnection;
  private js!: JetStreamClientWithSubscribe;
  private jsm!: JetStreamManager;

  constructor(private readonly natsUrl: string, readonly logger: Logger) {}

  /**
   * Establishes the TCP transport connection and initializes the JetStream context.
   */
  async connect() {
    this.nc = await connect({ servers: this.natsUrl });
    this.js = jetstream(this.nc) as JetStreamClientWithSubscribe;
    this.jsm = await jetstreamManager(this.nc);
    this.logger.info(`Connected to NATS Broker at ${this.natsUrl}`);
  }

  /**
   * Gracefully closes the underlying NATS connection.
   */
  async disconnect() {
    if (this.nc) {
      await this.nc.close();
      this.logger.info('Disconnected from NATS Broker');
    }
  }

  /**
   * Idempotently creates a JetStream stream to capture designated subjects.
   */
  async ensureStream(streamName: string, subjects: string[]) {
    try {
      await this.jsm.streams.add({ name: streamName, subjects });
      this.logger.debug(`Ensured JetStream '${streamName}' exists for subjects: ${subjects.join(', ')}`);
    } catch (err) {
      this.logger.warn(`Stream check warning (might already exist): ${(err as Error).message}`);
    }
  }

  /**
   * Publishes an event payload to a target subject using native TextEncoder serialization.
   */
  async publish(subject: string, payload: unknown, correlationId: string | null = null) {
    try {
      const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
      await this.js.publish(subject, encodedPayload);
      this.logger.debug(`Published event to ${subject}`, correlationId);
    } catch (err) {
      this.logger.error(`Failed to publish to ${subject}: ${(err as Error).message}`, correlationId);
      throw err;
    }
  }

  /**
   * Subscribes to a subject via a durable consumer, processing messages and auto-acking.
   */
  async subscribe(
    subject: string,
    durableName: string,
    handler: (payload: any, ack: () => void) => Promise<void>
  ) {
    const sub = await this.js.subscribe(subject, {
      config: { durable_name: durableName },
    });

    this.logger.info(`Subscribed to ${subject} as durable consumer '${durableName}'`);

    // Async generator loop to process inbound message streams
    (async () => {
      for await (const msg of sub) {
        try {
          // NATS v3 native msg.json() deserialization
          const payload = msg.json();
          await handler(payload, () => msg.ack());
        } catch (err) {
          this.logger.error(`Error processing event on ${subject}: ${(err as Error).message}`);
          // In production, consider negative acknowledgment (msg.nak()) depending on retry strategy
        }
      }
    })();
  }
}