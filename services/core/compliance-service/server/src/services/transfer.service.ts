// File: services/core/topology-service/server/src/services/transfer.service.ts
import { 
  DocumentsRepository, updateForDocNumberDataSchema, updateForReqNumberDataSchema 
} from '../repositories';
import { 
  transferEventCreatedDataSchema, transferEventUpdatedDataSchema, transferEventCompletedDataSchema,
} from '@contracts/topology';
import { TRANSFER_STATUS } from '@contracts/common'
import { z } from 'zod';

export const handleTransferEventCompletedDataSchema = transferEventCompletedDataSchema.transform((
  { ...rest }) => ({
    ...rest,
    status: TRANSFER_STATUS.COMPLETED,
  }
)).pipe(updateForReqNumberDataSchema);
type HandleTransferEventCompletedData = z.infer<typeof handleTransferEventCompletedDataSchema>;

export const handleTransferEventCreatedDataSchema = transferEventCreatedDataSchema.transform((
  { ...rest } ) => ({
    ...rest,
    status: TRANSFER_STATUS.IN_PROGRESS,
  }
)).pipe(updateForReqNumberDataSchema);
type HandleTransferEventCreatedData = z.infer<typeof handleTransferEventCreatedDataSchema>;

export const handleTransferEventUpdatedInputSchema = z.object({
  ...updateForDocNumberDataSchema.shape,
  ...updateForReqNumberDataSchema.shape,
  requisitionNumber: updateForReqNumberDataSchema.shape.requisitionNumber.optional(), 
});

export const handleTransferEventUpdatedDataSchema = transferEventUpdatedDataSchema.transform((
  { documentId, transferEventStatus, ...rest }) => ({
    ...rest,
    id: documentId,
    status: transferEventStatus,

  }
)).pipe(handleTransferEventUpdatedInputSchema);
type HandleTransferEventUpdatedData = z.infer<typeof handleTransferEventUpdatedDataSchema>;



export class TransferService {
  constructor(
    private readonly documents: DocumentsRepository,
  ) {}

  async handleTransferEventCreated(eventData: HandleTransferEventCreatedData) {
    await this.documents.updateForReqNumber(eventData);
  }
  async handleTransferEventUpdated(eventData: HandleTransferEventUpdatedData) {
    await this.documents.updateForDocNumber(updateForDocNumberDataSchema.parse({...eventData, status: TRANSFER_STATUS.COMPLETED}));
    const requisitionNumber = eventData.requisitionNumber ?? await this.documents.getRequisitionNumberById(eventData.id);
    await this.documents.updateForReqNumber(
      updateForReqNumberDataSchema.parse({...eventData, requisitionNumber})
    );
  }
  async handleTransferEventCompleted(eventData: HandleTransferEventCompletedData) {
    await this.documents.updateForReqNumber(eventData);
  }
}