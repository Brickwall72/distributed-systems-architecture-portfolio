// File: services/core/topology-service/server/src/repositories/assets/assets.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction, Record as Neo4jRecord } from 'neo4j-driver';
import { AssetsRepository } from './assets.repository';
import { AssetDTOSchema } from '@contracts/topology';
import { mockFromSchema } from '@shared/testing';
import { assetEntitySchema } from '../../domain';

function createMockRecord(data: object): Neo4jRecord {
  return { get: (key: string) => (data as Record<string, unknown>)[key] } as unknown as Neo4jRecord;
}

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
        filterControlType: null,
      }
    );
  });

  it('maps raw Neo4j record fields to AssetEntity domain shape including status and control type', async () => {
    const entity = mockFromSchema(assetEntitySchema);

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [createMockRecord(entity)],
      summary: {} as any,
    });

    const repo = new AssetsRepository(mockDriver as Driver);
    const results = await repo.findAssets({ filterOwnerId: entity.currentOwnerId, includeInTransit: false });

    expect(results).toEqual([entity]);
  });

  it('forwards filterControlType to the Cypher parameters', async () => {
    vi.mocked(mockTx.run!).mockResolvedValue({ records: [], summary: {} as any });

    const repo = new AssetsRepository(mockDriver as Driver);
    await repo.findAssets({ filterControlType: 'LOCAL', includeInTransit: false });

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('a.controlType = $filterControlType'),
      expect.objectContaining({ filterControlType: 'LOCAL' })
    );
  });

  it('executes createAsset write query and returns mapped AssetEntity', async () => {
    const newAssetDto = mockFromSchema(AssetDTOSchema, { name: 'GPS Navigation Unit', currentOwnerId: 'org-10' });
    const entity = mockFromSchema(assetEntitySchema, {
      id: newAssetDto.id,
      nomenclature: newAssetDto.nomenclature,
      serialNumber: newAssetDto.serialNumber,
      currentOwnerId: newAssetDto.currentOwnerId,
      status: newAssetDto.status,
      type: newAssetDto.type,
      controlType: newAssetDto.controlType,
    });

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [createMockRecord(entity)],
      summary: {} as any,
    });

    const repo = new AssetsRepository(mockDriver as Driver);
    const result = await repo.createAsset(newAssetDto);

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('CREATE (a:Asset'),
      expect.objectContaining({
        id: newAssetDto.id,
        name: newAssetDto.name,
        currentOwnerId: newAssetDto.currentOwnerId,
        status: newAssetDto.status,
        type: newAssetDto.type,
        controlType: newAssetDto.controlType,
      })
    );
    expect(result).toEqual(entity);
  });
});
