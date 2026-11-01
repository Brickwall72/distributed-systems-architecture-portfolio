// File: services/core/topology-service/server/src/mappers/organization/entity/organization.mapper.ts
import type { Record as Neo4jRecord } from 'neo4j-driver';
import type { OrganizationEntity } from '../../../domain';

export function mapRecordToOrganizationEntity(record: Neo4jRecord): OrganizationEntity {
  const id = record.get('id');

  // If Neo4j returned null for 'id' on any node, this throws and triggers the catch block -> 500
  if (typeof id !== 'string' || !id) {
    throw new Error('Database integrity error: Neo4j record missing string "id" property');
  }

  return {
    id,
    name: record.get('name') ?? '',
    type: record.get('type') ?? '',
    addressLine1: record.get('addressLine1') ?? undefined,
    addressLine2: record.get('addressLine2') ?? undefined,
    requisitions: record.get('requisitions') ?? undefined,
  };
}