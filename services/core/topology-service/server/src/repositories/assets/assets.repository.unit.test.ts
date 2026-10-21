// File: services/core/topology-service/server/src/repositories/assets/assets.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction, Record as Neo4jRecord } from 'neo4j-driver';
import { AssetsRepository } from './assets.repository';
import type { AssetDTO } from '@contracts/topology';

describe('AssetsRepository (Domain Mapping & Cypher Params)', () => {
  let mockTx: Partial<ManagedTransaction>;
  let mockSession: Partial<Session>;
  let mockDriver: Partial<Driver>;

  beforeEach(() => {
    mockTx = { run: vi.fn() };
    mockSession = {
      executeRead: vi.fn().mockImplementation(async (work) => work(mockTx as ManagedTransaction)),
      executeWrite: vi.fn().mockImplementation(async (work) => work(mockTx as ManagedTransaction)),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockDriver = { session: vi.fn().mockReturnValue(mockSession as Session) };
  });

  it('passes normalized null and optional filters to Cypher execution when params are omitted', async () => {
    vi.mocked(mockTx.run!).mockResolvedValue({ records: [], summary: {} as any });

    const repo = new AssetsRepository(mockDriver as Driver);
    await repo.findAssets({});

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('MATCH (a:Asset)'),
      {
        filterOwnerId: null,
        excludeOwnerId: null,
        includeInTransit: undefined,
      }
    );
  });

  it('maps raw Neo4j record fields to AssetEntity domain shape including status', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: vi.fn((key: string) => {
        const data: Record<string, string> = {
          id: 'ast-101',
          nomenclature: 'Radio',
          serialNumber: 'SN-01',
          currentOwnerId: 'org-10',
          status: 'AVAILABLE',
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
        status: 'AVAILABLE',
      },
    ]);
  });

  it('executes createAsset write query and returns mapped AssetEntity', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: vi.fn((key: string) => {
        const data: Record<string, string> = {
          id: 'ast-003',
          name: 'GPS Unit',
          nomenclature: 'GPS-III',
          serialNumber: 'SN-999',
          currentOwnerId: 'org-10',
          status: 'AVAILABLE',
        };
        return data[key];
      }),
    };

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [mockRecord as Neo4jRecord],
      summary: {} as any,
    });

    const repo = new AssetsRepository(mockDriver as Driver);
    const newAssetDto: AssetDTO = {
      id: 'ast-003',
      name: 'GPS Unit',
      nomenclature: 'GPS-III',
      serialNumber: 'SN-999',
      currentOwnerId: 'org-10',
      status: 'AVAILABLE',
    };

    const result = await repo.createAsset(newAssetDto);

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('CREATE (a:Asset'),
      expect.objectContaining({
        id: 'ast-003',
        name: 'GPS Unit',
        currentOwnerId: 'org-10',
        status: 'AVAILABLE',
      })
    );

    expect(result).toEqual({
      id: 'ast-003',
      nomenclature: 'GPS-III',
      serialNumber: 'SN-999',
      currentOwnerId: 'org-10',
      status: 'AVAILABLE',
    });
  });
});