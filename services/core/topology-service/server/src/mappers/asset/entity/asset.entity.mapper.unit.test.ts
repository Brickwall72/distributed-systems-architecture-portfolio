// File: services/core/topology-service/server/src/mappers/asset/entity/asset.entity.mapper.unit.test.ts
import type { Record as Neo4jRecord } from 'neo4j-driver';
import { mapRecordToAssetEntity } from './asset.entity.mapper';

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
    const record = createMockRecord({
      id: 'asset-123',
      nomenclature: 'AN/PRC-117G',
      serialNumber: 'SN-998231',
      currentOwnerId: 'org-456',
      status: 'AVAILABLE',
    });

    const result = mapRecordToAssetEntity(record);

    expect(result).toEqual({
      id: 'asset-123',
      nomenclature: 'AN/PRC-117G',
      serialNumber: 'SN-998231',
      currentOwnerId: 'org-456',
      status: 'AVAILABLE',
    });
  });

  it('coerces missing or non-string nomenclature and serialNumber to empty strings safely', () => {
    const record = createMockRecord({
      id: 'asset-123',
      nomenclature: null,
      serialNumber: undefined,
      currentOwnerId: 'org-456',
      status: 'AVAILABLE',
    });

    const result = mapRecordToAssetEntity(record);

    expect(result.nomenclature).toBe('');
    expect(result.serialNumber).toBe('');
  });

  it('throws a database integrity error when id is missing or not a string', () => {
    const missingIdRecord = createMockRecord({
      nomenclature: 'AN/PRC-117G',
      status: 'AVAILABLE',
    });

    const emptyIdRecord = createMockRecord({
      id: '',
      nomenclature: 'AN/PRC-117G',
      status: 'AVAILABLE',
    });

    expect(() => mapRecordToAssetEntity(missingIdRecord)).toThrowError(
      'Database integrity error: Neo4j record missing string "id" property'
    );

    expect(() => mapRecordToAssetEntity(emptyIdRecord)).toThrowError(
      'Database integrity error: Neo4j record missing string "id" property'
    );
  });
});