// File: services/core/topology-service/server/src/repositories/asset/asset.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction, Record as Neo4jRecord } from 'neo4j-driver';
import { TopologyAssetRepository } from './asset.repository.js';

describe('TopologyAssetRepository', () => {
  let mockTx: Partial<ManagedTransaction>;
  let mockSession: Partial<Session>;
  let mockDriver: Partial<Driver>;

  beforeEach(() => {
    mockTx = {
      run: vi.fn(),
    };

    mockSession = {
      executeRead: vi.fn().mockImplementation(async (work) => {
        return work(mockTx as ManagedTransaction);
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockDriver = {
      session: vi.fn().mockReturnValue(mockSession as Session),
    };
  });

  it('fetches assets and maps query parameters correctly when filters are provided', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: ((key: string | number) => {
        const fields: Record<string, unknown> = {
          id: 'asset-01',
          nomenclature: 'Radio',
          serialNumber: 'SN-01',
          currentOwnerId: 'org-01',
        };
        return fields[String(key)];
      }) as Neo4jRecord['get'],
    };

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [mockRecord as Neo4jRecord],
      summary: {} as any,
    });

    const repository = new TopologyAssetRepository(mockDriver as Driver);
    const result = await repository.findAssets({
      filterOwnerId: 'org-01',
      excludeOwnerId: 'org-02',
    });

    // 1. Verify Cypher parameters were passed correctly
    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('MATCH (a:Asset)'),
      {
        filterOwnerId: 'org-01',
        excludeOwnerId: 'org-02',
      }
    );

    // 2. Verify return mapping
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'asset-01',
      nomenclature: 'Radio',
      serialNumber: 'SN-01',
      currentOwnerId: 'org-01',
    });

    // 3. Verify session lifecycle cleanup
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('passes null for optional filters when undefined query values are provided', async () => {
    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [],
      summary: {} as any,
    });

    const repository = new TopologyAssetRepository(mockDriver as Driver);
    await repository.findAssets({});

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.anything(),
      {
        filterOwnerId: null,
        excludeOwnerId: null,
      }
    );
  });

  it('guarantees session closure even when query execution fails', async () => {
    vi.mocked(mockTx.run!).mockRejectedValue(new Error('Neo4j connection pool exhausted'));

    const repository = new TopologyAssetRepository(mockDriver as Driver);

    await expect(repository.findAssets({})).rejects.toThrow('Neo4j connection pool exhausted');

    // DevSecOps check: Session must close to prevent socket leaks in the container pool
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});