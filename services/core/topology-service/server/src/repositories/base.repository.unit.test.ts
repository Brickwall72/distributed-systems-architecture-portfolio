// File: services/core/topology-service/server/src/repositories/base.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction, Record as Neo4jRecord } from 'neo4j-driver';
import { BaseRepository } from './base.repository';

// Concrete test implementation extending the abstract BaseRepository
class TestRepository extends BaseRepository {
  async testQuery(params: Record<string, unknown>) {
    return this.executeReadQuery(
      'MATCH (n) RETURN n.id AS id',
      params,
      (record) => ({ id: record.get('id') as string })
    );
  }
}

describe('BaseRepository (Infrastructure & Resource Protection)', () => {
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

  it('executes read transaction and maps returned records', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: vi.fn().mockReturnValue('test-id-123'),
    };

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [mockRecord as Neo4jRecord],
      summary: {} as any,
    });

    const repo = new TestRepository(mockDriver as Driver);
    const results = await repo.testQuery({ param: 'val' });

    expect(results).toEqual([{ id: 'test-id-123' }]);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('guarantees session closure on transaction error to prevent socket leaks', async () => {
    vi.mocked(mockTx.run!).mockRejectedValue(new Error('Cypher execution syntax error'));

    const repo = new TestRepository(mockDriver as Driver);

    await expect(repo.testQuery({})).rejects.toThrow('Cypher execution syntax error');

    // DevSecOps check: Ensures connection pool socket leak protection
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});