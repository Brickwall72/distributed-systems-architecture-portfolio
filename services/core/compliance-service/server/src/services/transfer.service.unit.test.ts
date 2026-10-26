// File: services/core/topology-service/server/src/services/transfer.service.unit.test.ts
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
} from './transfer.service';
import type { DocumentsRepository } from '../repositories';
import { TransferService } from './transfer.service';

describe('Compliance TransferService', () => {
  let documents: {
    updateForDocNumber: ReturnType<typeof vi.fn>;
    updateForReqNumber: ReturnType<typeof vi.fn>;
    getRequisitionNumberById: ReturnType<typeof vi.fn>;
  };
  let service: TransferService;

  beforeEach(() => {
    vi.clearAllMocks();
    documents = {
      updateForDocNumber: vi.fn().mockResolvedValue(undefined),
      updateForReqNumber: vi.fn().mockResolvedValue(undefined),
      getRequisitionNumberById: vi.fn().mockResolvedValue('REQ-TEST'),
    };
    service = new TransferService(documents as unknown as DocumentsRepository);
  });

  it('maps created transfer events to an IN_PROGRESS requisition update', async () => {
    const event = zocker(transferEventCreatedDataSchema).generate();
    const input = handleTransferEventCreatedDataSchema.parse(event);

    await service.handleTransferEventCreated(input);

    expect(documents.updateForReqNumber).toHaveBeenCalledWith(input);
  });

  it('maps completed transfer events to a COMPLETED requisition update', async () => {
    const event = zocker(transferEventCompletedDataSchema).generate();
    const input = handleTransferEventCompletedDataSchema.parse(event);

    await service.handleTransferEventCompleted(input);

    expect(documents.updateForReqNumber).toHaveBeenCalledWith(input);
  });

  it('updates the document and resolves the requisition number when an updated event omits it', async () => {
    const event = zocker(transferEventUpdatedDataSchema.omit({ requisitionNumber: true })).generate();
    const input = handleTransferEventUpdatedDataSchema.parse(event);

    await service.handleTransferEventUpdated(input);

    expect(documents.updateForDocNumber).toHaveBeenCalledWith({
      id: event.documentId,
      status: event.transferEventStatus,
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
