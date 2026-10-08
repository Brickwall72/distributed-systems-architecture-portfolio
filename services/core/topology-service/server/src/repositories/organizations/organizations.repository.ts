// File: services/core/topology-service/server/src/repositories/organizations/organizations.repository.ts
import { BaseRepository } from '../base.repository';
import { mapRecordToOrganizationEntity } from '../../mappers';
import type { GetOrganizationsQuery } from 'topology-shared';
import type { OrganizationEntity } from '../../domain';

export class OrganizationsRepository extends BaseRepository {
  async findOrganizations(filters: GetOrganizationsQuery = {}): Promise<OrganizationEntity[]> {
    const cypher = `
      MATCH (o:Organization)
      WHERE ($filterOwnedId IS NULL OR EXISTS {
        MATCH (o)-[:HAS_CUSTODY]->(a:Asset { id: $filterOwnedId })
      })
      RETURN 
        o.id AS id,
        o.name AS name,
        o.type AS type,
        o.addressLine1 AS addressLine1,
        o.addressLine2 AS addressLine2
      ORDER BY o.name ASC
    `;

    return this.executeReadQuery(
      cypher,
      {
        filterOwnedId: filters.filterOwnedId ?? null,
      },
      mapRecordToOrganizationEntity
    );
  }
}