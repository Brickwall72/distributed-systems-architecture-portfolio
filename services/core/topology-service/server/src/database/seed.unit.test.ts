// File: services/core/topology-service/server/src/database/seed.unit.test.ts
import type { Driver, Session, ManagedTransaction } from 'neo4j-driver';
import { seedSpaceCustodyGraphTopology } from './seed';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('seedSpaceCustodyGraphTopology', () => {
  let run: ReturnType<typeof vi.fn>;
  let executeWrite: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;
  let driver: Driver;

  beforeEach(() => {
    vi.clearAllMocks();
    run = vi.fn().mockResolvedValue({ records: [], summary: {} });
    executeWrite = vi.fn(async (work) => work({ run } as unknown as ManagedTransaction));
    close = vi.fn().mockResolvedValue(undefined);
    driver = {
      session: vi.fn().mockReturnValue({ executeWrite, close } as unknown as Session),
    } as unknown as Driver;
  });

  it('creates constraints, runs the seed graph query, and closes the session', async () => {
    await seedSpaceCustodyGraphTopology(driver);

    expect(executeWrite).toHaveBeenCalledTimes(4);
    expect(run).toHaveBeenCalledTimes(4);
    expect(run.mock.calls.map(([query]) => query)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('idx_asset_id'),
        expect.stringContaining('idx_org_id'),
        expect.stringContaining('idx_transfer_req'),
        expect.stringContaining('MERGE (jeb:Organization'),
      ]),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the session and propagates a seed failure', async () => {
    const failure = new Error('seed write failed');
    executeWrite.mockRejectedValueOnce(failure);

    await expect(seedSpaceCustodyGraphTopology(driver)).rejects.toBe(failure);
    expect(close).toHaveBeenCalledOnce();
  });
});
