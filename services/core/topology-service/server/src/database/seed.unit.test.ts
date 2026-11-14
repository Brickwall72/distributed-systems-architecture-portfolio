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
        expect.stringContaining('MERGE (jeb:Organization'),
      ]),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('creates seeded transfer identities and dates in the API contract formats', async () => {
    await seedSpaceCustodyGraphTopology(driver);
    const seedQuery = run.mock.calls.find(([query]) => query.includes('MERGE (jeb:Organization'))?.[0] as string;
    expect(seedQuery).toContain("multiEvent.id = '10000000-0000-4000-8000-000000000001'");
    expect(seedQuery).toContain("multiEvent.date = '2026-09-15T00:00:00.000Z'");
    expect(seedQuery).toContain("eventHop1.id = '10000000-0000-4000-8000-000000000002'");
    expect(seedQuery).toContain("eventHop2.id = '10000000-0000-4000-8000-000000000003'");
    expect(seedQuery).toContain('WHERE existingCount = 0');
    expect(seedQuery).not.toContain("status: 'RECEIVED'");
  });

  it('closes the session and propagates a seed failure', async () => {
    const failure = new Error('seed write failed');
    executeWrite.mockRejectedValueOnce(failure);

    await expect(seedSpaceCustodyGraphTopology(driver)).rejects.toBe(failure);
    expect(close).toHaveBeenCalledOnce();
  });
});
