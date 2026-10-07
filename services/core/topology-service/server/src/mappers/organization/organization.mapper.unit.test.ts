// File: services/core/topology-service/server/src/mappers/organization/organization.mapper.unit.test.ts
import type { Record as Neo4jRecord } from 'neo4j-driver';
import { mapRecordToOrganizationEntity } from './organization.mapper';

/**
 * Utility helper to mock Neo4j Record instance without importing full driver internals.
 */
function createMockRecord(data: Record<string, unknown>): Neo4jRecord {
  return {
    get: (key: string) => data[key],
  } as unknown as Neo4jRecord;
}

describe('mapRecordToOrganizationEntity', () => {
  it('maps a valid complete Neo4j record to an OrganizationEntity', () => {
    const record = createMockRecord({
      id: 'org-123',
      name: '75th Ranger Regiment',
      type: 'MILITARY_BRANCH',
      addressLine1: 'Building 2730',
      addressLine2: 'Fort Moore, GA',
    });

    const result = mapRecordToOrganizationEntity(record);

    expect(result).toEqual({
      id: 'org-123',
      name: '75th Ranger Regiment',
      type: 'MILITARY_BRANCH',
      addressLine1: 'Building 2730',
      addressLine2: 'Fort Moore, GA',
    });
  });

  it('maps optional address fields to undefined when null or omitted in graph response', () => {
    const record = createMockRecord({
      id: 'org-123',
      name: 'Space Systems Command',
      type: 'MILITARY_BRANCH',
      addressLine1: null,
      addressLine2: undefined,
    });

    const result = mapRecordToOrganizationEntity(record);

    expect(result.addressLine1).toBeUndefined();
    expect(result.addressLine2).toBeUndefined();
  });

  it('coerces missing or non-string name and type to empty strings safely', () => {
    const record = createMockRecord({
      id: 'org-123',
      name: null,
      type: undefined,
    });

    const result = mapRecordToOrganizationEntity(record);

    expect(result.name).toBe('');
    expect(result.type).toBe('');
  });

  it('throws a database integrity error when id is missing, empty, or not a string', () => {
    const missingIdRecord = createMockRecord({
      name: 'HQ Air Force',
    });

    const emptyIdRecord = createMockRecord({
      id: '',
      name: 'HQ Air Force',
    });

    const nonStringIdRecord = createMockRecord({
      id: 12345,
      name: 'HQ Air Force',
    });

    expect(() => mapRecordToOrganizationEntity(missingIdRecord)).toThrowError(
      'Database integrity error: Neo4j record missing string "id" property'
    );

    expect(() => mapRecordToOrganizationEntity(emptyIdRecord)).toThrowError(
      'Database integrity error: Neo4j record missing string "id" property'
    );

    expect(() => mapRecordToOrganizationEntity(nonStringIdRecord)).toThrowError(
      'Database integrity error: Neo4j record missing string "id" property'
    );
  });
});