// File: services/core/topology-service/server/src/mappers/asset/asset.mapper.ts
import type { Record as Neo4jRecord } from 'neo4j-driver';
import type { AssetDTO } from '../../domain';

export function mapRecordToAssetDTO(record: Neo4jRecord): AssetDTO {
  const id = record.get('id');

  if (typeof id !== 'string' || !id) {
    throw new Error('Database integrity error: Neo4j record missing string "id" property');
  }

  return {
    id,
    nomenclature: String(record.get('nomenclature') ?? ''),
    serialNumber: String(record.get('serialNumber') ?? ''),
    currentOwnerId: record.get('currentOwnerId') ?? undefined,
  };
}