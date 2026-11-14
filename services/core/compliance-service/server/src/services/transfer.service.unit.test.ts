// File: services/core/compliance-service/server/src/services/transfer.service.unit.test.ts
import { zocker } from 'zocker';
import {
  transferEventCreatedDataSchema,
  transferEventUpdatedDataSchema,
  transferEventCompletedDataSchema,
} from '@contracts/topology';
import {
  handleTransferEventCreatedDataSchema,
  handleTransferEventUpdatedDataSchema,
  handleTransferEventCompletedDataSchema,
  TransferService,
} from './transfer.service';
import type { DocumentsRepository } from '../repositories';

describe('Compliance TransferService', () => {
  let documents: {
    updateForDocNumber: ReturnType<typeof vi.fn>;
    updateForReqNumber: ReturnType<typeof vi.fn>;
    getRequisitionNumberById: ReturnType<typeof vi.fn>;
    recordTransferParticipants: ReturnType<typeof vi.fn>;
    markTopologyApplied: ReturnType<typeof vi.fn>;
  };
  let service: TransferService;

  beforeEach(() => {
    vi.clearAllMocks();
    documents = {
      updateForDocNumber: vi.fn().mockResolvedValue(undefined),
      updateForReqNumber: vi.fn().mockResolvedValue(undefined),
      getRequisitionNumberById: vi.fn().mockResolvedValue('REQ-TEST'),
      recordTransferParticipants: vi.fn().mockResolvedValue(undefined),
      markTopologyApplied: vi.fn().mockResolvedValue(undefined),
    };
    service = new TransferService(documents as unknown as DocumentsRepository);
  });

  it('marks a signed document applied only after processing the matching topology result', async () => {
    const appliedDocumentId = '00000000-0000-4000-8000-000000000001';
    const event = { ...zocker(transferEventCreatedDataSchema).generate(), appliedDocumentId };
    await service.handleTransferEventCreated(handleTransferEventCreatedDataSchema.parse(event));
    expect(documents.markTopologyApplied).toHaveBeenCalledWith(appliedDocumentId, event.transferEventId);
    expect(documents.updateForReqNumber.mock.invocationCallOrder[0])
      .toBeLessThan(documents.markTopologyApplied.mock.invocationCallOrder[0]);
  });

  it('maps created transfer events to an IN_PROGRESS requisition update', async () => {
    const event = zocker(transferEventCreatedDataSchema).generate();
    const input = handleTransferEventCreatedDataSchema.parse(event);

    await service.handleTransferEventCreated(input);

    expect(documents.recordTransferParticipants).toHaveBeenCalledWith({
      requisitionNumber: input.requisitionNumber, transferEventId: input.transferEventId,
      senderOrgId: input.sender.id, receiverOrgId: input.receiver.id,
    });
    expect(documents.updateForReqNumber).toHaveBeenCalledWith(expect.objectContaining({
      requisitionNumber: input.requisitionNumber, transferEventId: input.transferEventId, status: input.status,
    }));
  });

  it('maps completed transfer events to a COMPLETED requisition update', async () => {
    const event = zocker(transferEventCompletedDataSchema).generate();
    const input = handleTransferEventCompletedDataSchema.parse(event);

    await service.handleTransferEventCompleted(input);

    expect(documents.recordTransferParticipants).toHaveBeenCalledWith({
      requisitionNumber: input.requisitionNumber, transferEventId: input.transferEventId,
      senderOrgId: input.sender.id, receiverOrgId: input.receiver.id,
    });

    expect(documents.updateForReqNumber).toHaveBeenCalledWith(expect.objectContaining({
      requisitionNumber: input.requisitionNumber, transferEventId: input.transferEventId, status: input.status,
    }));
  });

  it('does not update documents when participant metadata conflicts', async () => {
    documents.recordTransferParticipants.mockRejectedValueOnce(new Error('Conflicting transfer participant metadata'));
    const input = handleTransferEventCreatedDataSchema.parse(zocker(transferEventCreatedDataSchema).generate());

    await expect(service.handleTransferEventCreated(input)).rejects.toThrow('Conflicting transfer participant metadata');
    expect(documents.updateForReqNumber).not.toHaveBeenCalled();
  });

  it('updates the document and resolves the requisition number when an updated event omits it', async () => {
    const event = {
      ...zocker(transferEventUpdatedDataSchema.omit({ requisitionNumber: true })).generate(),
      transferEventStatus: 'PARTIALLY_COMPLETED' as const,
    };
    const input = handleTransferEventUpdatedDataSchema.parse(event);

    await service.handleTransferEventUpdated(input);

    // The receipt itself is COMPLETED while the transfer (authorization) stays PARTIALLY_COMPLETED.
    expect(documents.updateForDocNumber).toHaveBeenCalledWith({
      id: event.documentId,
      status: 'COMPLETED',
    });
    expect(documents.getRequisitionNumberById).toHaveBeenCalledWith(event.documentId);
    expect(documents.updateForReqNumber).toHaveBeenCalledWith({
      requisitionNumber: 'REQ-TEST',
      transferEventId: event.transferEventId,
      status: event.transferEventStatus,
    });
  });

  it('uses a requisition number already carried by an updated event', async () => {
    const event = zocker(transferEventUpdatedDataSchema).generate();
    const input = handleTransferEventUpdatedDataSchema.parse({
      ...event,
      requisitionNumber: 'REQ-CARRIED',
    });

    await service.handleTransferEventUpdated(input);

    expect(documents.getRequisitionNumberById).not.toHaveBeenCalled();
    expect(documents.updateForReqNumber).toHaveBeenCalledWith({
      requisitionNumber: 'REQ-CARRIED',
      transferEventId: event.transferEventId,
      status: event.transferEventStatus,
    });
  });

  it('surfaces a failure from the requisition update instead of completing early', async () => {
    documents.updateForReqNumber.mockRejectedValueOnce(new Error('database unavailable'));
    const input = handleTransferEventUpdatedDataSchema.parse(
      zocker(transferEventUpdatedDataSchema).generate(),
    );

    await expect(service.handleTransferEventUpdated(input)).rejects.toThrow('database unavailable');
  });
});
