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

    expect(executeWrite).toHaveBeenCalledTimes(6);
    expect(run).toHaveBeenCalledTimes(6);
    expect(run.mock.calls.map(([query]) => query)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('idx_asset_id'),
        expect.stringContaining('idx_org_id'),
        expect.stringContaining('idx_transfer_req'),
        expect.stringContaining('idx_transfer_claim_document'),
        expect.stringContaining('idx_transfer_claim_req'),
        expect.stringContaining('UNWIND $organizations'),
      ]),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('seeds at least twelve available assets and no transfer history only into an empty graph', async () => {
    await seedSpaceCustodyGraphTopology(driver);
    const seedCall = run.mock.calls.find(([query]) => query.includes('UNWIND $organizations'));
    const seedQuery = seedCall?.[0] as string;
    expect(seedQuery).toContain('WHERE existingCount = 0');
    expect(seedQuery).toContain("status: 'AVAILABLE'");
    expect(seedQuery).not.toMatch(/CREATE\s+\([^)]*:TransferEvent/);
    expect(seedCall?.[1].assets.length).toBeGreaterThanOrEqual(12);
    expect(new Set(seedCall?.[1].assets.map((asset: { id: string }) => asset.id)).size).toBe(seedCall?.[1].assets.length);
  });

  it('closes the session and propagates a seed failure', async () => {
    const failure = new Error('seed write failed');
    executeWrite.mockRejectedValueOnce(failure);

    await expect(seedSpaceCustodyGraphTopology(driver)).rejects.toBe(failure);
    expect(close).toHaveBeenCalledOnce();
  });
});
