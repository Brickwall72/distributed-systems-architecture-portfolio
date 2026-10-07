// File: services/core/topology-service/server/src/repositories/organizations/organizations.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction, Record as Neo4jRecord } from 'neo4j-driver';
import { OrganizationsRepository } from './organizations.repository';

describe('OrganizationsRepository (Domain Mapping & Cypher Params)', () => {
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

    const repo = new OrganizationsRepository(mockDriver as Driver);
    await repo.findOrganizations({});

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('MATCH (o:Organization)'),
      {
        filterOwnedId: null,
      }
    );
  });

  it('maps raw Neo4j record fields to OrganizationEntity domain shape', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: vi.fn((key: string) => {
        const data: Record<string, string> = {
          id: 'org-101',
          name: 'Space Systems Command',
          type: 'MILITARY_BRANCH',
          addressLine1: 'Building 2730',
          addressLine2: 'El Segundo, CA',
        };
        return data[key];
      }),
    };

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [mockRecord as Neo4jRecord],
      summary: {} as any,
    });

    const repo = new OrganizationsRepository(mockDriver as Driver);
    const results = await repo.findOrganizations({ filterOwnedId: 'ast-101' });

    expect(results).toEqual([
      {
        id: 'org-101',
        name: 'Space Systems Command',
        type: 'MILITARY_BRANCH',
        addressLine1: 'Building 2730',
        addressLine2: 'El Segundo, CA',
      },
    ]);
  });
});