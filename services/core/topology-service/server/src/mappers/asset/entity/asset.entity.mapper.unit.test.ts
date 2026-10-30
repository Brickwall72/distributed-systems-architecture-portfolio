// File: services/core/topology-service/server/src/mappers/asset/entity/asset.entity.mapper.unit.test.ts
import type { Record as Neo4jRecord } from 'neo4j-driver';
import { mockFromSchema } from '@shared/testing';
import { mapRecordToAssetEntity } from './asset.entity.mapper';
import { assetEntitySchema } from '../../../domain';

/**
 * Utility helper to mock Neo4j Record instance without importing full driver internals.
 */
function createMockRecord(data: Record<string, unknown>): Neo4jRecord {
  return {
    get: (key: string) => data[key],
  } as unknown as Neo4jRecord;
}

describe('mapRecordToAssetEntity', () => {
  it('maps a valid complete Neo4j record to an AssetEntity', () => {
    const entity = mockFromSchema(assetEntitySchema);

    expect(mapRecordToAssetEntity(createMockRecord(entity))).toEqual(entity);
  });

  it('rejects records whose properties violate the AssetEntity schema', () => {
    const entity = mockFromSchema(assetEntitySchema);

    expect(() => mapRecordToAssetEntity(createMockRecord({ ...entity, nomenclature: null }))).toThrow();
    expect(() => mapRecordToAssetEntity(createMockRecord({ ...entity, controlType: 'UNKNOWN' }))).toThrow();
  });

  it('throws a database integrity error when id is missing or not a string', () => {
    const entity = mockFromSchema(assetEntitySchema);
    const { id: _id, ...withoutId } = entity;

    expect(() => mapRecordToAssetEntity(createMockRecord(withoutId))).toThrowError(
      'Database integrity error: Neo4j record missing string "id" property'
    );

    expect(() => mapRecordToAssetEntity(createMockRecord({ ...entity, id: '' }))).toThrowError(
      'Database integrity error: Neo4j record missing string "id" property'
    );
  });
});
