// File: services/core/topology-service/server/src/repositories/graph/graph.repository.spec.ts
import { GraphRepository } from './graph.repository';
import type { Driver, Session } from 'neo4j-driver';

describe('GraphRepository', () => {
  let repository: GraphRepository;
  let mockSession: Partial<Session>;
  let mockDriver: Partial<Driver>;

  const mockTopologyRecord = {
    get: (key: string) => {
      if (key === 'topologyGraph') {
        return {
          organizations: [
            { id: 'org-1', name: 'Alpha Command', type: 'CONTRACTOR', addressLine1: 'Pad 39-B' },
          ],
          assets: [
            { id: 'asset-1', name: 'Probe Mk I', nomenclature: 'Probe Mk I', serialNumber: 'KSP-01', status: 'AVAILABLE' },
          ],
          activeTransfers: [],
          custodyLinks: [
            { orgId: 'org-1', assetId: 'asset-1' },
          ],
        };
      }
      return null;
    },
  };

  beforeEach(() => {
    mockSession = {
      executeRead: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          run: vi.fn().mockResolvedValue({
            records: [mockTopologyRecord],
          }),
        };
        return callback(tx);
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockDriver = {
      session: vi.fn().mockReturnValue(mockSession as Session),
    } as unknown as Driver;

    repository = new GraphRepository(mockDriver as Driver);
  });

  it('should successfully execute read query and return structured GraphDTO', async () => {
    const graph = await repository.getGraph();

    expect(mockSession.executeRead).toHaveBeenCalledTimes(1);
    expect(graph).toHaveProperty('timestamp');
    expect(graph.organizations).toHaveLength(1);
    expect(graph.organizations[0].name).toBe('Alpha Command');
    expect(graph.assets).toHaveLength(1);
    expect(graph.assets[0].status).toBe('AVAILABLE');
    expect(graph.custodyLinks).toHaveLength(1);
    expect(graph.custodyLinks[0]).toEqual({ orgId: 'org-1', assetId: 'asset-1' });
  });

  it('should return fallback empty collections if query yields no records', async () => {
    (mockSession.executeRead as any).mockImplementation(async (callback: any) => {
      const tx = {
        run: vi.fn().mockResolvedValue({
          records: [],
        }),
      };
      return callback(tx);
    });

    const graph = await repository.getGraph();

    expect(graph.organizations).toEqual([]);
    expect(graph.assets).toEqual([]);
    expect(graph.activeTransfers).toEqual([]);
    expect(graph.custodyLinks).toEqual([]);
    expect(graph.timestamp).toBeTypeOf('string');
  });
});