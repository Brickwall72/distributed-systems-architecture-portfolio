// File: services/core/topology-service/server/src/repositories/assets/assets.repository.ts
import { BaseRepository } from '../base.repository';
import { mapRecordToAssetEntity } from '../../mappers';
import type { GetAssetsQuery, AssetEntity } from 'topology-shared';

export class AssetsRepository extends BaseRepository {
  async findAssets(filters: GetAssetsQuery = {}): Promise<AssetEntity[]> {
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

    return this.executeReadQuery(
      cypher,
      {
        filterOwnerId: filters.filterOwnerId ?? null,
        excludeOwnerId: filters.excludeOwnerId ?? null,
      },
      mapRecordToAssetEntity
    );
  }
}