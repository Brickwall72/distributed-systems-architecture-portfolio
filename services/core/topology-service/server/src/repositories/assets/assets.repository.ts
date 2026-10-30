// File: services/core/topology-service/server/src/repositories/assets/assets.repository.ts
import { BaseRepository } from '../base.repository';
import { mapRecordToAssetEntity } from '../../mappers';
import type { AssetEntity } from '../../domain';
import { GetAssetsQuery, AssetDTO, ASSET_STATUS } from '@contracts/topology';

export class AssetsRepository extends BaseRepository {
  async findAssets(filters: GetAssetsQuery): Promise<AssetEntity[]> {

    const cypher = `
      MATCH (a:Asset)
      WHERE ($filterOwnerId IS NULL OR EXISTS {
        MATCH (o:Organization {id: $filterOwnerId})-[:HAS_CUSTODY]->(a)
      })
      AND ($excludeOwnerId IS NULL OR NOT EXISTS {
        MATCH (eo:Organization {id: $excludeOwnerId})-[:HAS_CUSTODY]->(a)
      })
      AND ($includeInTransit = true OR a.status <> 'IN_TRANSIT')
      AND ($filterControlType IS NULL OR a.controlType = $filterControlType)
      RETURN 
        a.id AS id,
        a.nomenclature AS nomenclature,
        a.serialNumber AS serialNumber,
        a.status AS status,
        a.type AS type,
        a.controlType as controlType,
        [(owner:Organization)-[:HAS_CUSTODY]->(a) | owner.id][0] AS currentOwnerId
      ORDER BY currentOwnerId ASC, a.nomenclature ASC
    `;

    return this.executeReadQuery(
      cypher,
      {
        filterOwnerId: filters.filterOwnerId ?? null,
        excludeOwnerId: filters.excludeOwnerId ?? null,
        includeInTransit: filters.includeInTransit,
        filterControlType: filters.filterControlType ?? null,
      },
      mapRecordToAssetEntity
    );
  }

  async createAsset(dto: AssetDTO): Promise<AssetEntity> {
    const cypher = `
      MATCH (o:Organization {id: $currentOwnerId})
      CREATE (a:Asset {
        id: $id,
        name: $name,
        nomenclature: $nomenclature,
        serialNumber: $serialNumber,
        type: $type,
        controlType: $controlType,
        status: $status
      })
      CREATE (o)-[:HAS_CUSTODY]->(a)
      RETURN 
        a.id AS id,
        a.name AS name,
        a.nomenclature AS nomenclature,
        a.serialNumber AS serialNumber,
        a.status AS status,
        a.type AS type,
        a.controlType as controlType,
        $currentOwnerId AS currentOwnerId
    `;

    const records = await this.executeWriteQuery(
      cypher,
      {
        ...dto,
        status: dto.status ?? ASSET_STATUS.AVAILABLE,
      },
      mapRecordToAssetEntity
    );

    if (!records[0]) {
      throw new Error(`Failed to create asset ${dto.id} or organization ${dto.currentOwnerId} was not found.`);
    }

    return records[0];
  }
}