// File: services/core/topology-service/server/src/repositories/transfers/transfers.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction } from 'neo4j-driver';
import { mockFromSchema } from '@shared/testing';
import { transferStatusEnum } from '@contracts/common';
import { z } from 'zod';
import {
  TransfersRepository,
  createTransferEventSchema,
  updateTransferEventSchema,
} from './transfers.repository';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('TransfersRepository (Cypher Params & Transfer Flow)', () => {
  let mockTx: Partial<ManagedTransaction>;
  let mockSession: Partial<Session>;
  let mockDriver: Partial<Driver>;
  let repo: TransfersRepository;
  let requisitionNumber: string;

  beforeEach(() => {
    requisitionNumber = mockFromSchema(z.string());
    mockTx = {
      run: vi.fn(async (query: string, params: Record<string, unknown>) => {
        const recordData = query.includes('RETURN e.id AS id')
          ? { id: params.id }
          : mockFromSchema(
              z.object({ requisitionNumber: z.string(), status: transferStatusEnum }),
              { requisitionNumber, status: 'COMPLETED' },
            );
        return {
          records: [{
            get: (key: string) => (recordData as Record<string, unknown>)[key],
          }],
          summary: {},
        };
      }) as unknown as ManagedTransaction['run'],
    };
    mockSession = {
      executeWrite: vi.fn().mockImplementation(async (work) => work(mockTx as ManagedTransaction)),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockDriver = { session: vi.fn().mockReturnValue(mockSession as Session) };
    repo = new TransfersRepository(mockDriver as Driver);
  });

  it('writes the initiated transfer with a generated id and returns IN_PROGRESS', async () => {
    const params = mockFromSchema(createTransferEventSchema, { type: 'PHYSICAL_TRANSFER' });

    const result = await repo.createTransferEvent(params);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('MERGE (e:TransferEvent'),
      { ...params, id: result.id },
    );
    expect(result).toEqual({ id: expect.any(String) });
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('does not complete the transfer for PHYSICAL_TRANSFER', async () => {
    await repo.createTransferEvent(mockFromSchema(createTransferEventSchema, { type: 'PHYSICAL_TRANSFER' }));

    expect(mockTx.run).toHaveBeenCalledTimes(1);
  });

  it('creates a C2_TRANSFER and returns its generated id for the service to complete', async () => {
    const params = mockFromSchema(createTransferEventSchema, { type: 'C2_TRANSFER' });
    const result = await repo.createTransferEvent(params);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('RETURN e.id AS id'),
      expect.objectContaining({ requisitionNumber: params.requisitionNumber }),
    );
    expect(result.id).toEqual(expect.any(String));
  });

  it('writes the received transfer and returns the computed status', async () => {
    const params = mockFromSchema(updateTransferEventSchema);

    const result = await repo.updateTransferEvent(params);

    expect(mockTx.run).toHaveBeenCalledWith(expect.stringContaining('calculatedStatus'), params);
    expect(result).toEqual({ requisitionNumber, status: 'COMPLETED' });
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('throws when no transfer event matches the received transfer', async () => {
    vi.mocked(mockTx.run!).mockResolvedValueOnce({ records: [], summary: {} } as never);
    await expect(repo.updateTransferEvent(mockFromSchema(updateTransferEventSchema))).rejects.toThrow('not found');
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('closes the session and propagates when the write fails', async () => {
    vi.mocked(mockTx.run!).mockRejectedValueOnce(new Error('neo4j down'));

    await expect(repo.updateTransferEvent(mockFromSchema(updateTransferEventSchema))).rejects.toThrow('neo4j down');
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});
