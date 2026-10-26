// File: services/core/topology-service/server/src/repositories/graph/graph.repository.ts
import { BaseRepository } from '../base.repository';
import type { GraphDTO } from 'topology-shared';

export class GraphRepository extends BaseRepository {
  async getGraph(): Promise<GraphDTO> {
    // Each section is its own subquery: a global collect() always yields one row (possibly an empty list),
    // so an empty section can no longer wipe out the rest of the graph.
    const query = `
      CALL {
        MATCH (o:Organization)
        RETURN collect(DISTINCT {
          id: o.id,
          name: o.name,
          type: o.type,
          addressLine1: o.addressLine1,
          addressLine2: o.addressLine2
        }) AS organizations
      }

      CALL {
        MATCH (a:Asset)
        RETURN collect(DISTINCT {
          id: a.id,
          name: a.name,
          nomenclature: a.nomenclature,
          serialNumber: a.serialNumber,
          status: a.status
        }) AS assets
      }

      // Active transfers are those not yet fully completed, with their involved assets aggregated
      CALL {
        MATCH (e:TransferEvent)
        WHERE e.status IN ['IN_PROGRESS', 'PARTIALLY_COMPLETED']
        OPTIONAL MATCH (sender:Organization)-[:DELIVERED_FROM]->(e)
        OPTIONAL MATCH (e)-[:DELIVERED_TO]->(receiver:Organization)
        OPTIONAL MATCH (e)-[inv:INVOLVES]->(asset:Asset)
        WITH e, sender, receiver, collect(DISTINCT {
          id: asset.id,
          nomenclature: asset.nomenclature,
          serialNumber: asset.serialNumber,
          status: inv.status
        }) AS transferAssets
        RETURN collect(DISTINCT {
          requisitionNumber: e.requisitionNumber,
          date: e.date,
          type: e.type,
          status: e.status,
          senderOrgId: sender.id,
          senderName: sender.name,
          receiverOrgId: receiver.id,
          receiverName: receiver.name,
          assets: [item IN transferAssets WHERE item.id IS NOT NULL]
        }) AS activeTransfers
      }

      // Current HAS_CUSTODY relationships, omitting assets currently in transit
      CALL {
        MATCH (org:Organization)-[:HAS_CUSTODY]->(ast:Asset)
        WHERE NOT (
          ()-[:INVOLVES { status: 'IN_TRANSIT' }]->(ast)
        )
        RETURN collect(DISTINCT {
          orgId: org.id,
          assetId: ast.id
        }) AS custodyLinks
      }

      RETURN {
        organizations: organizations,
        assets: assets,
        activeTransfers: activeTransfers,
        custodyLinks: custodyLinks
      } AS topologyGraph
    `;

    const result = await this.executeReadQuery(query, {}, (record) => record.get('topologyGraph'));
    const rawGraph = result[0] || {
      organizations: [],
      assets: [],
      activeTransfers: [],
      custodyLinks: [],
    };

    return {
      timestamp: new Date().toISOString(),
      ...rawGraph,
    };
  }
}