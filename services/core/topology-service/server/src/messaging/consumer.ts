// File: services/core/topology-service/server/src/messaging/consumer.ts
import { EventBroker } from '@shared/messaging';
import { COMPLIANCE_EVENT_SUBJECTS, TransferInitiatedEvent, TransferReceivedEvent } from '@contracts/compliance';
import { handleTransferInitiatedParamsSchema, handleTransferReceivedParamsSchema, TransfersRepository } from '../repositories';
import { createLogger } from '@shared/express';

const logger = createLogger('Topology:consumer');

export class ComplianceEventConsumer {
  constructor(
    private readonly broker: EventBroker,
    private readonly transferRepo: TransfersRepository
  ) {}

  public async start(): Promise<void> {
    await this.broker.ensureStream(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [
      COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL,
    ]);

    // 1. Listen for Transfer Initiated
    await this.broker.subscribe(
      COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME,
      'topology-service-transfer-initiated-consumer',
      async (event: TransferInitiatedEvent, ack) => {
        logger.info(`Transfer Initiated Event received:${JSON.stringify(event)}`);
        const params = handleTransferInitiatedParamsSchema.parse({...event.data, type: event.data.transferType});
        await this.transferRepo.handleTransferInitiated(params);
        ack();
      },
      COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED
    );

    // 2. Listen for Transfer Received
    await this.broker.subscribe(
      COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME,
      'topology-service-transfer-received-consumer',
      async (event: TransferReceivedEvent, ack) => {
        logger.info(`Transfer Initiated Event received:${JSON.stringify(event)}`);
        const params = handleTransferReceivedParamsSchema.parse(event.data);
        await this.transferRepo.handleTransferReceived(params);
        ack();
      },
      COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED
    );
  }
}