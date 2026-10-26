// File: services/core/topology-service/server/src/services/transfer.service.ts
import { 
  updateTransferEventSchema, createTransferEventSchema, TransfersRepository 
} from '../repositories';
import { transferInitiatedDataSchema, transferReceivedDataSchema } from '@contracts/compliance';
import { 
  TopologyPublisher, publishTransferEventCompletedDataSchema, publishTransferEventCreatedDataSchema, publishTransferEventUpdatedDataSchema 
} from '../messaging';
import { z } from 'zod';

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
      await this.publisher.publishTransferEventCompleted(
        publishTransferEventCompletedDataSchema.parse({ requisitionNumber: eventData.requisitionNumber, id })
      );
    } else {
      await this.publisher.publishTransferEventCreated(
        publishTransferEventCreatedDataSchema.parse({
          requisitionNumber: eventData.requisitionNumber,
          status: 'IN_PROGRESS',
          id,
        })
      );
    }
  }
  async handleTransferReceived(eventData: HandleTransferReceivedData) {
    const results = await this.transferRepo.updateTransferEvent(
      updateTransferEventSchema.parse(eventData)
    );

    if (results.status === 'COMPLETED') {
      await this.publisher.publishTransferEventCompleted(
        publishTransferEventCompletedDataSchema.parse({...eventData, ...results})
      );
    } else {
      await this.publisher.publishTransferEventUpdated(
        publishTransferEventUpdatedDataSchema.parse({...eventData, ...results})
      );
    }

  }
}