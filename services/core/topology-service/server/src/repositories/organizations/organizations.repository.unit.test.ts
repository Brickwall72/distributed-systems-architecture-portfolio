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

  it('passes transferEventId and role through to Cypher execution', async () => {
    vi.mocked(mockTx.run!).mockResolvedValue({ records: [], summary: {} as any });

    const repo = new OrganizationsRepository(mockDriver as Driver);
    await repo.findOrganizations({ requireActiveAssets: false, transferEventId: 'evt-1', transferEventRole: 'SENDER' });

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('TransferEvent'),
      { filterOwnedId: null, excludeOrgId: null, transferEventId: 'evt-1', transferEventRole: 'SENDER', requireActiveAssets: false }
    );
  });

  it('passes the counterpart org and asset filters alongside the transfer role', async () => {
    vi.mocked(mockTx.run!).mockResolvedValue({ records: [], summary: {} as any });

    const repo = new OrganizationsRepository(mockDriver as Driver);
    await repo.findOrganizations({
      requireActiveAssets: false,
      transferEventRole: 'SENDER',
      excludeOrgId: 'org-recv',
      filterOwnedId: 'ast-1',
    });

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('requisitions'),
      {
        filterOwnedId: 'ast-1',
        excludeOrgId: 'org-recv',
        transferEventId: null,
        transferEventRole: 'SENDER',
        requireActiveAssets: false,
      }
    );
  });

  it('passes normalized null filters and default requireActiveAssets to Cypher execution when optional params are omitted', async () => {
    vi.mocked(mockTx.run!).mockResolvedValue({ records: [], summary: {} as any });

    const repo = new OrganizationsRepository(mockDriver as Driver);
    await repo.findOrganizations({ requireActiveAssets: true });

    expect(mockTx.run).toHaveBeenCalledWith(
      expect.stringContaining('MATCH (o:Organization)'),
      {
        filterOwnedId: null,
        excludeOrgId: null,
        transferEventId: null,
        transferEventRole: 'ANY',
        requireActiveAssets: true,
      }
    );
  });

  it('maps raw Neo4j record fields to OrganizationEntity domain shape', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: vi.fn((key: string | number) => {
        const data: Record<string, string> = {
          id: 'org-101',
          name: 'Space Systems Command',
          type: 'GOV_AGENCY',
          addressLine1: 'Building 2730',
          addressLine2: 'El Segundo, CA',
          requisitions: ['REQ-1', 'REQ-2'],
        } as unknown as Record<string, string>;
        return data[String(key)];
      }) as unknown as Neo4jRecord['get'],
    };

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [mockRecord as Neo4jRecord],
      summary: {} as any,
    });

    const repo = new OrganizationsRepository(mockDriver as Driver);
    const results = await repo.findOrganizations({
      filterOwnedId: 'ast-101',
      requireActiveAssets: true,
    });

    expect(results).toEqual([
      {
        id: 'org-101',
        name: 'Space Systems Command',
        type: 'GOV_AGENCY',
        addressLine1: 'Building 2730',
        addressLine2: 'El Segundo, CA',
        requisitions: ['REQ-1', 'REQ-2'],
      },
    ]);
  });
});