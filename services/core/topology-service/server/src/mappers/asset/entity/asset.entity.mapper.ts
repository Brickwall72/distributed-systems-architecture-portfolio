// File: services/core/topology-service/server/src/mappers/asset/entity/asset.entity.mapper.ts
import type { Record as Neo4jRecord } from 'neo4j-driver';
import type { AssetEntity } from '../../../domain';

export function mapRecordToAssetEntity(record: Neo4jRecord): AssetEntity {
  const id = record.get('id');

  if (typeof id !== 'string' || !id) {
    throw new Error('Database integrity error: Neo4j record missing string "id" property');
  }

  const nomenclature = record.get('nomenclature');
  const serialNumber = record.get('serialNumber');
  const currentOwnerId = record.get('currentOwnerId');
  const status = record.get('status');

  return {
    id,
    nomenclature: typeof nomenclature === 'string' ? nomenclature : '',
    serialNumber: typeof serialNumber === 'string' ? serialNumber : '',
    currentOwnerId: typeof currentOwnerId === 'string' ? currentOwnerId : '',
    status: typeof status === 'string' ? (status as any) : 'AVAILABLE',
  };
}