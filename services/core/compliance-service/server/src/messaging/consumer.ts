// File: services/core/compliance-service/server/src/messaging/consumer.ts
import { EventBroker } from '@shared/messaging';
import { 
  TOPOLOGY_EVENT_SUBJECTS, TransferEventCreatedEvent, TransferEventUpdatedEvent, TransferEventCompletedEvent,
} from '@contracts/topology';
import { TOPOLOGY_DURABLE_CONSUMERS } from './durableConsumers';
import { 
  TransferService, handleTransferEventCreatedDataSchema, 
  handleTransferEventUpdatedDataSchema, handleTransferEventCompletedDataSchema
} from '../services';
import { createLogger } from '@shared/express';

const logger = createLogger('Compliance:consumer');

export class ComplianceEventConsumer {
  constructor(
    private readonly broker: EventBroker,
    private readonly transferService: TransferService
  ) {}

  public async start(signal?: AbortSignal): Promise<void> {
    await this.broker.waitForStream(TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME, [
      TOPOLOGY_EVENT_SUBJECTS.WILDCARD_ALL,
    ], signal);

    // 1. Listen for Transfer Initiated
    await this.broker.subscribe(
      TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME,
      TOPOLOGY_DURABLE_CONSUMERS.COMPLIANCE_CREATED,
      async (event: TransferEventCreatedEvent, ack) => {
        logger.info(`Transfer Initiated Event received:${JSON.stringify(event)}`);
        await this.transferService.handleTransferEventCreated(
          handleTransferEventCreatedDataSchema.parse(event.data)
        );
        ack();
      },
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED
    );

    // 2. Listen for Transfer Received
    await this.broker.subscribe(
      TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME,
      TOPOLOGY_DURABLE_CONSUMERS.COMPLIANCE_UPDATED,
      async (event: TransferEventUpdatedEvent, ack) => {
        logger.info(`Transfer Initiated Event received:${JSON.stringify(event)}`);
        await this.transferService.handleTransferEventUpdated(
          handleTransferEventUpdatedDataSchema.parse(event.data)
        );
        ack();
      },
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED
    );

    // 2. Listen for Transfer Completed
    await this.broker.subscribe(
      TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME,
      TOPOLOGY_DURABLE_CONSUMERS.COMPLIANCE_COMPLETED,
      async (event: TransferEventCompletedEvent, ack) => {
        logger.info(`Transfer Initiated Event received:${JSON.stringify(event)}`);
        await this.transferService.handleTransferEventCompleted(
          handleTransferEventCompletedDataSchema.parse(event.data)
        );
        ack();
      },
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED
    );
  }
}