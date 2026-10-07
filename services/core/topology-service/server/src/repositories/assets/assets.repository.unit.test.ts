// File: services/core/topology-service/server/src/repositories/assets/assets.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction, Record as Neo4jRecord } from 'neo4j-driver';
import { AssetsRepository } from './assets.repository';

describe('AssetsRepository (Domain Mapping & Cypher Params)', () => {
  let mockTx: Partial<ManagedTransaction>;
  let mockSession: Partial<Session>;
  let mockDriver: Partial<Driver>;

  beforeEach(() => {
    mockTx = { run: vi.fn() };
    mockSession = {
      executeRead: vi.fn().mockImplementation(async (work) => work(mockTx as ManagedTransaction)),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockDriver = { session: vi.fn().mockReturnValue(mockSession as Session) };
  });

  it('passes normalized null filters to Cypher execution when optional params are omitted', async () => {
    vi.mocked(mockTx.run!).mockResolvedValue({ records: [], summary: {} as any });

    const repo = new AssetsRepository(mockDriver as Driver);
    await repo.findAssets({});

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('MATCH (a:Asset)'),
      {
        filterOwnerId: null,
        excludeOwnerId: null,
      }
    );
  });

  it('maps raw Neo4j record fields to AssetEntity domain shape', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: vi.fn((key: string) => {
        const data: Record<string, string> = {
          id: 'ast-101',
          nomenclature: 'Radio',
          serialNumber: 'SN-01',
          currentOwnerId: 'org-10',
        };
        return data[key];
      }),
    };

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [mockRecord as Neo4jRecord],
      summary: {} as any,
    });

    const repo = new AssetsRepository(mockDriver as Driver);
    const results = await repo.findAssets({ filterOwnerId: 'org-10' });

    expect(results).toEqual([
      {
        id: 'ast-101',
        nomenclature: 'Radio',
        serialNumber: 'SN-01',
        currentOwnerId: 'org-10',
      },
    ]);
  });
});