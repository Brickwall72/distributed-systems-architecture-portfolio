// File: services/core/topology-service/server/src/services/transfer.service.unit.test.ts
import { mockFromSchema } from '@shared/testing';
import { transferInitiatedDataSchema, transferReceivedDataSchema } from '@contracts/compliance';
import { transferAssetSnapshotSchema, transferOrganizationSnapshotSchema } from '@contracts/topology';
import { z } from 'zod';
import type { TransfersRepository } from '../repositories';
import type { TopologyPublisher } from '../messaging';
import {
  handletransferReceivedDataSchema,
  handleTransferInitiatedDataSchema,
  TransferService,
} from './transfer.service';

describe('Topology TransferService', () => {
  let transferRepo: {
    createTransferEvent: ReturnType<typeof vi.fn>;
    updateTransferEvent: ReturnType<typeof vi.fn>;
    findTransferEventSnapshot: ReturnType<typeof vi.fn>;
  };
  let publisher: {
    publishTransferEventCreated: ReturnType<typeof vi.fn>;
    publishTransferEventUpdated: ReturnType<typeof vi.fn>;
    publishTransferEventCompleted: ReturnType<typeof vi.fn>;
  };
  let service: TransferService;
  let transferEventId: string;

  const buildSnapshot = (overrides: Record<string, unknown> = {}) => {
    const assets = [mockFromSchema(transferAssetSnapshotSchema), mockFromSchema(transferAssetSnapshotSchema)];
    return {
      id: transferEventId,
      requisitionNumber: 'REQ-TEST',
      type: 'PHYSICAL_TRANSFER',
      date: new Date().toISOString(),
      status: 'IN_PROGRESS',
      sender: mockFromSchema(transferOrganizationSnapshotSchema),
      receiver: mockFromSchema(transferOrganizationSnapshotSchema),
      assets,
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    transferEventId = mockFromSchema(z.string().uuid());
    transferRepo = {
      createTransferEvent: vi.fn().mockResolvedValue({ id: transferEventId }),
      updateTransferEvent: vi.fn().mockResolvedValue({
        requisitionNumber: 'REQ-TEST',
        status: 'PARTIALLY_COMPLETED',
      }),
      findTransferEventSnapshot: vi.fn(),
    };
    publisher = {
      publishTransferEventCreated: vi.fn().mockResolvedValue(undefined),
      publishTransferEventUpdated: vi.fn().mockResolvedValue(undefined),
      publishTransferEventCompleted: vi.fn().mockResolvedValue(undefined),
    };
    service = new TransferService(
      transferRepo as unknown as TransfersRepository,
      publisher as unknown as TopologyPublisher,
    );
  });

  it('creates a physical transfer and publishes the created boundary payload', async () => {
    const data = mockFromSchema(transferInitiatedDataSchema, { transferType: 'PHYSICAL_TRANSFER' });
    const input = handleTransferInitiatedDataSchema.parse(data);
    const snapshot = buildSnapshot({ requisitionNumber: data.requisitionNumber });
    transferRepo.findTransferEventSnapshot.mockResolvedValueOnce(snapshot);

    await service.handleTransferInitiated(input);

    expect(transferRepo.createTransferEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PHYSICAL_TRANSFER', requisitionNumber: data.requisitionNumber }),
    );
    expect(transferRepo.updateTransferEvent).not.toHaveBeenCalled();
    expect(publisher.publishTransferEventCreated).toHaveBeenCalledWith({
      requisitionNumber: data.requisitionNumber,
      transferEventId,
      transferType: 'PHYSICAL_TRANSFER',
      date: snapshot.date,
      sender: snapshot.sender,
      receiver: snapshot.receiver,
      assets: snapshot.assets,
    });
    expect(publisher.publishTransferEventCompleted).not.toHaveBeenCalled();
  });

  it('completes a C2 transfer before publishing its completion event', async () => {
    const data = mockFromSchema(transferInitiatedDataSchema, { transferType: 'C2_TRANSFER', assetIds: ['asset-1', 'asset-2'] });
    const input = handleTransferInitiatedDataSchema.parse(data);
    const snapshot = buildSnapshot({ requisitionNumber: data.requisitionNumber, type: 'C2_TRANSFER', status: 'COMPLETED' });
    snapshot.assets[0].id = data.assetIds[0];
    transferRepo.findTransferEventSnapshot.mockResolvedValueOnce(snapshot);

    await service.handleTransferInitiated(input);

    expect(transferRepo.updateTransferEvent).toHaveBeenCalledWith({
      id: transferEventId,
      assetIds: data.assetIds,
    });
    expect(publisher.publishTransferEventCompleted).toHaveBeenCalledWith({
      requisitionNumber: data.requisitionNumber,
      transferEventId,
      transferType: 'C2_TRANSFER',
      transferEventStatus: 'COMPLETED',
      date: snapshot.date,
      sender: snapshot.sender,
      receiver: snapshot.receiver,
      assets: snapshot.assets,
      receivedAssets: [snapshot.assets[0]],
    });
    expect(publisher.publishTransferEventCreated).not.toHaveBeenCalled();
  });

  it.each([
    ['PARTIALLY_COMPLETED', 'publishTransferEventUpdated'],
    ['COMPLETED', 'publishTransferEventCompleted'],
  ] as const)('routes a received transfer with status %s to the correct publisher', async (status, method) => {
    transferRepo.updateTransferEvent.mockResolvedValueOnce({
      requisitionNumber: 'REQ-TEST',
      status: mockFromSchema(z.enum([status])),
    });
    const data = mockFromSchema(transferReceivedDataSchema, { assetIds: ['asset-1', 'asset-2'] });
    const input = handletransferReceivedDataSchema.parse(data);
    const snapshot = buildSnapshot({ id: data.transferEventId, requisitionNumber: 'REQ-TEST' });
    snapshot.assets[0].id = data.assetIds[0];
    transferRepo.findTransferEventSnapshot.mockResolvedValueOnce(snapshot);

    await service.handleTransferReceived(input);

    expect(transferRepo.updateTransferEvent).toHaveBeenCalledWith({
      id: data.transferEventId,
      assetIds: data.assetIds,
    });
    if (method === 'publishTransferEventCompleted') {
      expect(publisher.publishTransferEventCompleted).toHaveBeenCalledWith(expect.objectContaining({
        requisitionNumber: 'REQ-TEST',
        transferEventId: data.transferEventId,
        transferEventStatus: 'COMPLETED',
        documentId: data.documentId,
        assets: snapshot.assets,
        receivedAssets: [snapshot.assets[0]],
      }));
    } else {
      expect(publisher.publishTransferEventUpdated).toHaveBeenCalledWith({
        requisitionNumber: 'REQ-TEST',
        transferEventId: data.transferEventId,
        documentId: data.documentId,
        transferEventStatus: status,
        receivedAssets: [snapshot.assets[0]],
      });
    }
  });

  it('propagates repository failures and does not publish an event', async () => {
    transferRepo.createTransferEvent.mockRejectedValueOnce(new Error('graph unavailable'));
    const input = handleTransferInitiatedDataSchema.parse(
      mockFromSchema(transferInitiatedDataSchema, { transferType: 'PHYSICAL_TRANSFER' }),
    );

    await expect(service.handleTransferInitiated(input)).rejects.toThrow('graph unavailable');
    expect(publisher.publishTransferEventCreated).not.toHaveBeenCalled();
  });

  it('propagates publisher failures to the caller', async () => {
    transferRepo.findTransferEventSnapshot.mockResolvedValueOnce(buildSnapshot());
    publisher.publishTransferEventCreated.mockRejectedValueOnce(new Error('NATS unavailable'));
    const input = handleTransferInitiatedDataSchema.parse(
      mockFromSchema(transferInitiatedDataSchema, { transferType: 'PHYSICAL_TRANSFER' }),
    );

    await expect(service.handleTransferInitiated(input)).rejects.toThrow('NATS unavailable');
  });
});
