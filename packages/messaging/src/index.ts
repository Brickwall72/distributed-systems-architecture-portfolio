// File: packages/messaging/src/index.ts
import { connect, NatsConnection } from '@nats-io/transport-node';
import { 
  jetstream, 
  jetstreamManager, 
  JetStreamClient, 
  JetStreamManager,
  AckPolicy,
  Consumer
} from '@nats-io/jetstream';

/**
 * Structural logging contract required by EventBroker.
 */
export interface Logger {
  info(message: string, correlationId?: string | null): void;
  warn(message: string, correlationId?: string | null): void;
  error(message: string, correlationId?: string | null): void;
  debug(message: string, correlationId?: string | null): void;
}

export class EventBroker {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private jsm!: JetStreamManager;

  constructor(private readonly natsUrl: string, readonly logger: Logger) {
    if (!natsUrl) {
      throw new Error('EventBroker initialization failed: NATS URL is required but was undefined or empty.');
    }
  }

  /**
   * Establishes TCP connection with exponential reconnect policy and initializes JetStream context.
   */
  async connect() {
    this.logger.info(`Attempting connection to NATS Broker at ${this.natsUrl}`);
    
    this.nc = await connect({ 
      servers: this.natsUrl,
      maxReconnectAttempts: 10,
      reconnectTimeWait: 2000,
      waitOnFirstConnect: true,
    });

    this.js = jetstream(this.nc);
    this.jsm = await jetstreamManager(this.nc);
    this.logger.info(`Successfully connected to NATS Broker at ${this.natsUrl}`);
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
   * Subscribes to a JetStream stream using a durable consumer.
   * 
   * @param streamName The JetStream stream identifier (e.g., 'ESIGN_EVENTS')
   * @param durableName The durable consumer identifier (e.g., 'compliance-service')
   * @param handler Message handler callback
   * @param filterSubject Optional subject filter (e.g., 'events.esign.compliance.document.signed')
   */
  async subscribe(
    streamName: string,
    durableName: string,
    handler: (payload: any, ack: () => void) => Promise<void>,
    filterSubject?: string
  ) {
    let consumer: Consumer;

    try {
      consumer = await this.js.consumers.get(streamName, durableName);
    } catch {
      await this.jsm.consumers.add(streamName, {
        durable_name: durableName,
        filter_subject: filterSubject,
        ack_policy: AckPolicy.Explicit,
      });

      consumer = await this.js.consumers.get(streamName, durableName);
    }

    const messages = await consumer.consume();
    this.logger.info(`Subscribed to stream '${streamName}' as durable consumer '${durableName}'`);

    (async () => {
      for await (const msg of messages) {
        try {
          const payload = msg.json();
          await handler(payload, () => msg.ack());
        } catch (err) {
          this.logger.error(`Error processing event on ${msg.subject}: ${(err as Error).message}`);
          msg.nak();
        }
      }
    })();
  }
}