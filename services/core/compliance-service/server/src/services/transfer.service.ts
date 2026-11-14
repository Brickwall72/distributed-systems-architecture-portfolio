// File: services/core/compliance-service/server/src/services/transfer.service.ts
import { 
  DocumentsRepository, updateForDocNumberDataSchema, updateForReqNumberDataSchema 
} from '../repositories';
import { 
  transferEventCreatedDataSchema, transferEventUpdatedDataSchema, transferEventCompletedDataSchema,
} from '@contracts/topology';
import { TRANSFER_STATUS } from '@contracts/common'
import { z } from 'zod';

const participantsSchema = z.object({
  sender: z.object({ id: z.string().min(1) }),
  receiver: z.object({ id: z.string().min(1) }),
});
const applicationSchema = z.object({ appliedDocumentId: z.string().uuid().optional() });

export const handleTransferEventCompletedDataSchema = transferEventCompletedDataSchema
  .transform((event) => ({ ...event, status: TRANSFER_STATUS.COMPLETED }))
  .pipe(updateForReqNumberDataSchema.merge(participantsSchema).merge(applicationSchema));
type HandleTransferEventCompletedData = z.infer<typeof handleTransferEventCompletedDataSchema>;

export const handleTransferEventCreatedDataSchema = transferEventCreatedDataSchema
  .transform((event) => ({ ...event, status: TRANSFER_STATUS.IN_PROGRESS }))
  .pipe(updateForReqNumberDataSchema.merge(participantsSchema).merge(applicationSchema));
type HandleTransferEventCreatedData = z.infer<typeof handleTransferEventCreatedDataSchema>;

export const handleTransferEventUpdatedInputSchema = z.object({
  ...updateForDocNumberDataSchema.shape,
  ...updateForReqNumberDataSchema.shape,
  requisitionNumber: updateForReqNumberDataSchema.shape.requisitionNumber.optional(), 
  ...applicationSchema.shape,
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
    await this.recordParticipants(eventData);
    await this.documents.updateForReqNumber(updateForReqNumberDataSchema.parse(eventData));
    await this.markApplied(eventData);
  }
  async handleTransferEventUpdated(eventData: HandleTransferEventUpdatedData) {
    await this.documents.updateForDocNumber(updateForDocNumberDataSchema.parse({...eventData, status: TRANSFER_STATUS.COMPLETED}));
    const requisitionNumber = eventData.requisitionNumber ?? await this.documents.getRequisitionNumberById(eventData.id);
    await this.documents.updateForReqNumber(
      updateForReqNumberDataSchema.parse({...eventData, requisitionNumber})
    );
    await this.markApplied(eventData);
  }
  async handleTransferEventCompleted(eventData: HandleTransferEventCompletedData) {
    await this.recordParticipants(eventData);
    await this.documents.updateForReqNumber(
      updateForReqNumberDataSchema.parse({ ...eventData, status: TRANSFER_STATUS.COMPLETED })
    );
    await this.markApplied(eventData);
  }

  private async markApplied(eventData: { appliedDocumentId?: string; transferEventId: string }) {
    if (eventData.appliedDocumentId) {
      await this.documents.markTopologyApplied(eventData.appliedDocumentId, eventData.transferEventId);
    }
  }

  private async recordParticipants(eventData: HandleTransferEventCreatedData | HandleTransferEventCompletedData) {
    await this.documents.recordTransferParticipants({
      requisitionNumber: eventData.requisitionNumber,
      transferEventId: eventData.transferEventId,
      senderOrgId: eventData.sender.id,
      receiverOrgId: eventData.receiver.id,
    });
  }
}