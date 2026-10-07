// File: services/core/topology-service/server/src/repositories/asset/asset.repository.ts
import { Driver } from 'neo4j-driver';
import { mapRecordToAssetEntity } from '../../mappers';
import type { GetAssetsQuery } from 'topology-shared';
import type { TopologyAssetEntity } from '../../domain';

export class TopologyAssetRepository {
  constructor(private readonly driver: Driver) {}

  async findAssets(filters: GetAssetsQuery): Promise<TopologyAssetEntity[]> {
    const session = this.driver.session();
    try {
      const cypher = `
        MATCH (a:Asset)
        WHERE ($filterOwnerId IS NULL OR EXISTS {
          MATCH (o:Organization {id: $filterOwnerId})-[:HAS_CUSTODY]->(a)
        })
        AND ($excludeOwnerId IS NULL OR NOT EXISTS {
          MATCH (eo:Organization {id: $excludeOwnerId})-[:HAS_CUSTODY]->(a)
        })
        WITH a, [(owner:Organization)-[:HAS_CUSTODY]->(a) | owner.id][0] AS currentOwnerId
        RETURN a.id AS id, 
               a.nomenclature AS nomenclature, 
               a.serialNumber AS serialNumber, 
               currentOwnerId
      `;

      const result = await session.executeRead((tx) =>
        tx.run(cypher, {
          filterOwnerId: filters.filterOwnerId ?? null,
          excludeOwnerId: filters.excludeOwnerId ?? null,
        })
      );

      return result.records.map(mapRecordToAssetEntity);
    } finally {
      await session.close();
    }
  }
}