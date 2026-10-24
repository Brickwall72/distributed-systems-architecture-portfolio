// File: services/core/topology-service/server/src/repositories/graph/graph.repository.ts
import { BaseRepository } from '../base.repository';
import type { GraphDTO } from 'topology-shared';

export class GraphRepository extends BaseRepository {
  async getGraph(): Promise<GraphDTO> {
    const query = `
      // 1. Gather all Organizations
      MATCH (o:Organization)
      WITH collect(DISTINCT {
        id: o.id,
        name: o.name,
        type: o.type,
        addressLine1: o.addressLine1,
        addressLine2: o.addressLine2
      }) as organizations

      // 2. Gather all Assets with Status
      MATCH (a:Asset)
      WITH organizations, collect(DISTINCT {
        id: a.id,
        name: a.name,
        nomenclature: a.nomenclature,
        serialNumber: a.serialNumber,
        status: a.status
      }) as assets

      // 3. Gather active/in-transit Transfer Events, aggregating their involved assets into an array
      MATCH (e:TransferEvent)
      WHERE e.status = 'PARTIALLY_COMPLETED' OR e.status = 'IN_TRANSIT'
      OPTIONAL MATCH (sender:Organization)-[:DELIVERED_FROM]->(e)
      OPTIONAL MATCH (e)-[:DELIVERED_TO]->(receiver:Organization)
      OPTIONAL MATCH (e)-[inv:INVOLVES]->(asset:Asset)
      WITH organizations, assets, e, sender, receiver, collect(DISTINCT {
        id: asset.id,
        nomenclature: asset.nomenclature,
        serialNumber: asset.serialNumber,
        status: inv.status
      }) as transferAssets
      WITH organizations, assets, collect(DISTINCT {
        requisitionNumber: e.requisitionNumber,
        date: e.date,
        type: e.type,
        status: e.status,
        senderOrgId: sender.id,
        senderName: sender.name,
        receiverOrgId: receiver.id,
        receiverName: receiver.name,
        assets: [item IN transferAssets WHERE item.id IS NOT NULL]
      }) as activeTransfers

      // 4. Gather current HAS_CUSTODY relationships, omitting assets currently in-transit
      MATCH (org:Organization)-[:HAS_CUSTODY]->(ast:Asset)
      WHERE NOT (
        ()-[:INVOLVES { status: 'IN_TRANSIT' }]->(ast)
      )
      WITH organizations, assets, activeTransfers, collect(DISTINCT {
        orgId: org.id,
        assetId: ast.id
      }) as custodyLinks

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