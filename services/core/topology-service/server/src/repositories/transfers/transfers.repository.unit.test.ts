import type { Driver, Session, ManagedTransaction } from 'neo4j-driver';
import { mockFromSchema } from '@shared/testing';
import {
  TransfersRepository,
  handleTransferInitiatedParamsSchema,
  handleTransferReceivedParamsSchema,
} from './transfers.repository';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('TransfersRepository (Cypher Params & Transfer Flow)', () => {
  let mockTx: Partial<ManagedTransaction>;
  let mockSession: Partial<Session>;
  let mockDriver: Partial<Driver>;
  let repo: TransfersRepository;

  beforeEach(() => {
    mockTx = { run: vi.fn().mockResolvedValue({ records: [], summary: {} }) };
    mockSession = {
      executeWrite: vi.fn().mockImplementation(async (work) => work(mockTx as ManagedTransaction)),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockDriver = { session: vi.fn().mockReturnValue(mockSession as Session) };
    repo = new TransfersRepository(mockDriver as Driver);
  });

  it('writes the initiated transfer with the schema-valid params and closes the session', async () => {
    const params = mockFromSchema(handleTransferInitiatedParamsSchema, { type: 'PHYSICAL_TRANSFER' });

    await repo.handleTransferInitiated(params);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockTx.run).toHaveBeenCalledWith(expect.stringContaining('MERGE (e:TransferEvent'), params);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('does not complete the transfer for PHYSICAL_TRANSFER', async () => {
    await repo.handleTransferInitiated(mockFromSchema(handleTransferInitiatedParamsSchema, { type: 'PHYSICAL_TRANSFER' }));
    await Promise.resolve();

    expect(mockTx.run).not.toHaveBeenCalledWith(expect.stringContaining("e.status = 'COMPLETED'"), expect.anything());
  });

  it('auto-completes the transfer for C2_TRANSFER', async () => {
    const params = mockFromSchema(handleTransferInitiatedParamsSchema, { type: 'C2_TRANSFER' });

    await repo.handleTransferInitiated(params);
    await vi.waitFor(() => expect(mockTx.run).toHaveBeenCalledTimes(2));

    expect(mockTx.run).toHaveBeenLastCalledWith(
      expect.stringContaining("e.status = 'COMPLETED'"),
      expect.anything(),
    );
  });

  it('writes the received transfer with the schema-valid params', async () => {
    const params = mockFromSchema(handleTransferReceivedParamsSchema);

    await repo.handleTransferReceived(params);

    expect(mockTx.run).toHaveBeenCalledWith(expect.stringContaining("e.status = 'COMPLETED'"), params);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('closes the session and propagates when the write fails', async () => {
    vi.mocked(mockTx.run!).mockRejectedValueOnce(new Error('neo4j down'));

    await expect(repo.handleTransferReceived(mockFromSchema(handleTransferReceivedParamsSchema))).rejects.toThrow('neo4j down');
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});
