// File: services/core/topology-service/server/src/repositories/assets/assets.repository.ts
import { Driver } from 'neo4j-driver';
import { mapRecordToAssetEntity } from '../../mappers';
import type { GetAssetsQuery } from 'topology-shared';
import type { AssetEntity } from '../../domain';

export class AssetsRepository {
  constructor(private readonly driver: Driver) {}

  async findAssets(filters: GetAssetsQuery): Promise<AssetEntity[]> {
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
        RETURN 
          a.id AS id,
          a.nomenclature AS nomenclature,
          a.serialNumber AS serialNumber,
          [(owner:Organization)-[:HAS_CUSTODY]->(a) | owner.id][0] AS currentOwnerId
        ORDER BY currentOwnerId ASC, a.nomenclature ASC
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