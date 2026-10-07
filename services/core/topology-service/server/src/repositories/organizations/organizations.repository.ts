// File: services/core/topology-service/server/src/repositories/organizations/organizations.repository.ts
import { Driver } from 'neo4j-driver';
import { mapRecordToOrganizationEntity } from '../../mappers';
import type { GetOrganizationsQuery } from 'topology-shared';
import type { OrganizationEntity } from '../../domain';

export class OrganizationsRepository {
  constructor(private readonly driver: Driver) {}

  async findOrganizations(filters: GetOrganizationsQuery = {}): Promise<OrganizationEntity[]> {
    const session = this.driver.session();
    try {
      const cypher = `
        MATCH (o:Organization)
        WHERE ($filterOwnedId IS NULL OR EXISTS {
          MATCH (o)-[:OWNS]->(a:Asset { id: $filterOwnedId })
        })
        RETURN 
          o.id AS id,
          o.name AS name,
          o.type AS type,
          o.addressLine1 AS addressLine1,
          o.addressLine2 AS addressLine2
        ORDER BY o.name ASC
      `;

      const result = await session.executeRead((tx) =>
        tx.run(cypher, {
          filterOwnedId: filters.filterOwnedId ?? null,
        })
      );

      return result.records.map(mapRecordToOrganizationEntity);
    } finally {
      await session.close();
    }
  }
}