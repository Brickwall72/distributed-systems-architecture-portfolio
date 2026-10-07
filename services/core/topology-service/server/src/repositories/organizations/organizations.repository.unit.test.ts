// File: services/core/topology-service/server/src/repositories/organizations/organizations.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction, Record as Neo4jRecord } from 'neo4j-driver';
import { OrganizationsRepository } from './organizations.repository';

describe('OrganizationsRepository', () => {
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

  it('fetches organizations and passes query parameters correctly when filters are provided', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: ((key: string | number) => {
        const fields: Record<string, unknown> = {
          id: 'org-01',
          name: '75th Ranger Regiment',
          type: 'MILITARY_BRANCH',
          addressLine1: 'Building 2730',
          addressLine2: 'Fort Moore, GA',
        };
        return fields[String(key)];
      }) as Neo4jRecord['get'],
    };

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [mockRecord as Neo4jRecord],
      summary: {} as any,
    });

    const repository = new OrganizationsRepository(mockDriver as Driver);
    const result = await repository.findOrganizations({
      filterOwnedId: 'asset-99',
    });

    // 1. Verify Cypher query structure and parameters
    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('MATCH (o:Organization)'),
      {
        filterOwnedId: 'asset-99',
      }
    );

    // 2. Verify return mapping matches OrganizationEntity shape
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'org-01',
      name: '75th Ranger Regiment',
      type: 'MILITARY_BRANCH',
      addressLine1: 'Building 2730',
      addressLine2: 'Fort Moore, GA',
    });

    // 3. Verify session lifecycle cleanup
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('passes null for optional filterOwnedId when undefined query values are provided', async () => {
    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [],
      summary: {} as any,
    });

    const repository = new OrganizationsRepository(mockDriver as Driver);
    await repository.findOrganizations({});

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.anything(),
      {
        filterOwnedId: null,
      }
    );
  });

  it('guarantees session closure even when query execution fails', async () => {
    vi.mocked(mockTx.run!).mockRejectedValue(new Error('Neo4j connection pool exhausted'));

    const repository = new OrganizationsRepository(mockDriver as Driver);

    await expect(repository.findOrganizations({})).rejects.toThrow('Neo4j connection pool exhausted');

    // DevSecOps check: Session must close to prevent socket leaks in the container pool
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});