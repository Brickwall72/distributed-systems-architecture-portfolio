// File: services/core/topology-service/server/src/repositories/base.repository.unit.test.ts
import type { Driver, Session, ManagedTransaction, Record as Neo4jRecord } from 'neo4j-driver';
import { BaseRepository } from './base.repository';

// Concrete test implementation extending the abstract BaseRepository
class TestRepository extends BaseRepository {
  async testReadQuery(params: Record<string, unknown>) {
    return this.executeReadQuery(
      'MATCH (n) RETURN n.id AS id',
      params,
      (record) => ({ id: record.get('id') as string })
    );
  }

  async testWriteQuery(params: Record<string, unknown>) {
    return this.executeWriteQuery(
      'CREATE (n:Node {id: $id}) RETURN n.id AS id',
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
      executeWrite: vi.fn().mockImplementation(async (work) => {
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
    const results = await repo.testReadQuery({ param: 'val' });

    expect(results).toEqual([{ id: 'test-id-123' }]);
    expect(mockSession.executeRead).toHaveBeenCalledTimes(1);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('guarantees session closure on read transaction error to prevent socket leaks', async () => {
    vi.mocked(mockTx.run!).mockRejectedValue(new Error('Cypher read syntax error'));

    const repo = new TestRepository(mockDriver as Driver);

    await expect(repo.testReadQuery({})).rejects.toThrow('Cypher read syntax error');

    // DevSecOps check: Ensures connection pool socket leak protection on failure
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('executes write transaction and maps returned records', async () => {
    const mockRecord: Partial<Neo4jRecord> = {
      get: vi.fn().mockReturnValue('new-node-456'),
    };

    vi.mocked(mockTx.run!).mockResolvedValue({
      records: [mockRecord as Neo4jRecord],
      summary: {} as any,
    });

    const repo = new TestRepository(mockDriver as Driver);
    const results = await repo.testWriteQuery({ id: 'new-node-456' });

    expect(results).toEqual([{ id: 'new-node-456' }]);
    expect(mockSession.executeWrite).toHaveBeenCalledTimes(1);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('guarantees session closure on write transaction error to prevent socket leaks', async () => {
    vi.mocked(mockTx.run!).mockRejectedValue(new Error('Cypher write constraint violation'));

    const repo = new TestRepository(mockDriver as Driver);

    await expect(repo.testWriteQuery({})).rejects.toThrow('Cypher write constraint violation');

    // DevSecOps check: Ensures connection pool socket leak protection on write failure
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});