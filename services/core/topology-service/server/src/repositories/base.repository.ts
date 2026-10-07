// File: services/core/topology-service/server/src/repositories/base.repository.ts
import { Driver, type Record as Neo4jRecord } from 'neo4j-driver';

export abstract class BaseRepository {
  constructor(protected readonly driver: Driver) {}

  /**
   * Executes a read transaction with guaranteed session cleanup to prevent socket leaks.
   */
  protected async executeReadQuery<TDomainEntity>(
    cypher: string,
    params: Record<string, unknown>,
    mapper: (record: Neo4jRecord) => TDomainEntity
  ): Promise<TDomainEntity[]> {
    const session = this.driver.session();
    try {
      const result = await session.executeRead((tx) => tx.run(cypher, params));
      return result.records.map(mapper);
    } finally {
      await session.close();
    }
  }
}