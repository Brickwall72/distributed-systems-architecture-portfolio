// File: services/core/topology-service/server/src/services/transfer.service.ts
import { 
  updateTransferEventSchema, createTransferEventSchema, TransfersRepository 
} from '../repositories';
import { transferInitiatedDataSchema, transferReceivedDataSchema } from '@contracts/compliance';
import { 
  TopologyPublisher, publishTransferEventCompletedDataSchema, publishTransferEventCreatedDataSchema, publishTransferEventUpdatedDataSchema 
} from '../messaging';
import { z } from 'zod';
import { createLogger } from '@shared/express';

const logger = createLogger('topology:transfer-service');

export const handleTransferReceivedInputsSchema = updateTransferEventSchema.extend({ documentId: z.string().uuid() });
export const handletransferReceivedDataSchema = transferReceivedDataSchema.transform((
  { transferEventId, ...rest }) => ({
    ...rest,
    id: transferEventId,
  }
)).pipe(handleTransferReceivedInputsSchema);
type HandleTransferReceivedData = z.infer<typeof handletransferReceivedDataSchema>;

export const handleTransferInitiatedDataSchema = transferInitiatedDataSchema.transform((
  { transferType, ...rest }) => ({
    ...rest,
    type: transferType,
  }
)).pipe(createTransferEventSchema);
type HandleTransferInitiatedData = z.infer<typeof handleTransferInitiatedDataSchema>;

export class TransferService {
  constructor(
    private readonly transferRepo: TransfersRepository,
    private readonly publisher: TopologyPublisher
  ) {}

  async handleTransferInitiated(eventData: HandleTransferInitiatedData) {
    const { id } = await this.transferRepo.createTransferEvent(
      createTransferEventSchema.parse(eventData)
    );

    if (eventData.type === 'C2_TRANSFER') { // C2 transfers are immediately resolved due to the nature of control.
      await this.transferRepo.updateTransferEvent(
        updateTransferEventSchema.parse({ assetIds: eventData.assetIds, id })
      );
      const snapshot = await this.transferRepo.findTransferEventSnapshot(id);
      logger.info(`Publishing completed event for C2 transfer ${snapshot.requisitionNumber}`);
      await this.publisher.publishTransferEventCompleted(
        publishTransferEventCompletedDataSchema.parse({
          ...snapshot,
          receivedAssets: snapshot.assets.filter((asset) => eventData.assetIds.includes(asset.id)),
        })
      );
    } else {
      const snapshot = await this.transferRepo.findTransferEventSnapshot(id);
      logger.info(`Publishing created event for transfer ${snapshot.requisitionNumber}`);
      await this.publisher.publishTransferEventCreated(
        publishTransferEventCreatedDataSchema.parse(snapshot)
      );
    }
  }
  async handleTransferReceived(eventData: HandleTransferReceivedData) {
    const results = await this.transferRepo.updateTransferEvent(
      updateTransferEventSchema.parse(eventData)
    );
    const snapshot = await this.transferRepo.findTransferEventSnapshot(eventData.id);
    const receivedAssets = snapshot.assets.filter((asset) => eventData.assetIds.includes(asset.id));

    if (results.status === 'COMPLETED') {
      logger.info(`Publishing completed event for transfer ${snapshot.requisitionNumber}`);
      await this.publisher.publishTransferEventCompleted(
        publishTransferEventCompletedDataSchema.parse({ ...snapshot, documentId: eventData.documentId, receivedAssets })
      );
    } else {
      logger.info(`Publishing updated event for transfer ${snapshot.requisitionNumber} (${results.status})`);
      await this.publisher.publishTransferEventUpdated(
        publishTransferEventUpdatedDataSchema.parse({
          id: snapshot.id,
          requisitionNumber: snapshot.requisitionNumber,
          status: results.status,
          documentId: eventData.documentId,
          receivedAssets,
        })
      );
    }
  }
}
