// File: services/core/topology-service/server/src/repositories/organizations/organizations.repository.ts
import { BaseRepository } from '../base.repository';
import { mapRecordToOrganizationEntity } from '../../mappers';
import type { GetOrganizationsQuery } from '@contracts/topology';
import type { OrganizationEntity } from '../../domain';

export class OrganizationsRepository extends BaseRepository {
  async findOrganizations(filters: GetOrganizationsQuery): Promise<OrganizationEntity[]> {
    const requireActiveAssets = filters.requireActiveAssets ?? true;

    // An event is "open" while IN_PROGRESS/PARTIALLY_COMPLETED; an explicit transferEventId pins one event regardless.
    // When a role is given, filterOwnedId (asset) and excludeOrgId (counterpart org) must belong to the same event.
    const cypher = `
      MATCH (o:Organization)
      WHERE ($filterOwnedId IS NULL OR $transferEventRole <> 'ANY' OR EXISTS {
        MATCH (o)-[:HAS_CUSTODY]->(a:Asset { id: $filterOwnedId })
      })
      AND ($requireActiveAssets = false OR EXISTS {
        MATCH (o)-[:HAS_CUSTODY]->(activeAsset:Asset)
        WHERE activeAsset.status <> 'IN_TRANSIT'
      })
      WITH o,
        [(o)-[:DELIVERED_FROM]->(e:TransferEvent)
          WHERE $transferEventRole <> 'RECEIVER'
            AND (($transferEventId IS NULL AND e.status IN ['IN_PROGRESS', 'PARTIALLY_COMPLETED']) OR e.id = $transferEventId)
            AND ($filterOwnedId IS NULL OR $transferEventRole = 'ANY' OR EXISTS { MATCH (e)-[:INVOLVES]->(:Asset {id: $filterOwnedId}) })
            AND ($excludeOrgId IS NULL OR $transferEventRole = 'ANY' OR EXISTS { MATCH (e)-[:DELIVERED_TO]->(:Organization {id: $excludeOrgId}) })
          | e.requisitionNumber]
        +
        [(e:TransferEvent)-[:DELIVERED_TO]->(o)
          WHERE $transferEventRole <> 'SENDER'
            AND (($transferEventId IS NULL AND e.status IN ['IN_PROGRESS', 'PARTIALLY_COMPLETED']) OR e.id = $transferEventId)
            AND ($filterOwnedId IS NULL OR $transferEventRole = 'ANY' OR EXISTS { MATCH (e)-[:INVOLVES]->(:Asset {id: $filterOwnedId}) })
            AND ($excludeOrgId IS NULL OR $transferEventRole = 'ANY' OR EXISTS { MATCH (:Organization {id: $excludeOrgId})-[:DELIVERED_FROM]->(e) })
          | e.requisitionNumber]
        AS requisitions
      WHERE ($transferEventId IS NULL AND $transferEventRole = 'ANY') OR size(requisitions) > 0
      RETURN 
        o.id AS id,
        o.name AS name,
        o.type AS type,
        o.addressLine1 AS addressLine1,
        o.addressLine2 AS addressLine2,
        requisitions
      ORDER BY o.name ASC
    `;

    return this.executeReadQuery(
      cypher,
      {
        filterOwnedId: filters.filterOwnedId ?? null,
        excludeOrgId: filters.excludeOrgId ?? null,
        transferEventId: filters.transferEventId ?? null,
        transferEventRole: filters.transferEventRole ?? 'ANY',
        requireActiveAssets,
      },
      mapRecordToOrganizationEntity
    );
  }
}