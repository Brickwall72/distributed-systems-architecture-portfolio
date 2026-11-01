// File: services/core/topology-service/server/src/mappers/asset/entity/asset.entity.mapper.ts
import type { Record as Neo4jRecord } from 'neo4j-driver';
import { assetEntitySchema, ControlType, AssetStatus } from '../../../domain';

export function mapRecordToAssetEntity(record: Neo4jRecord) {
  const id = record.get('id');

  if (typeof id !== 'string' || !id) {
    throw new Error('Database integrity error: Neo4j record missing string "id" property');
  }

  const nomenclature = record.get('nomenclature') as string;
  const serialNumber = record.get('serialNumber') as string ;
  const currentOwnerId = record.get('currentOwnerId') as string;
  const status = record.get('status') as AssetStatus;
  const type = record.get('type') as string;
  const controlType = record.get('controlType') as ControlType;

  const requisitionNumber = record.get('requisitionNumber') ?? undefined;

  return assetEntitySchema.parse({
    id,
    nomenclature,
    serialNumber,
    currentOwnerId,
    status,
    type,
    controlType,
    requisitionNumber,
  });
}