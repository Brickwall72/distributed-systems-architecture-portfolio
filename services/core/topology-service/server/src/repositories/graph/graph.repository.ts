// File: services/core/topology-service/server/src/repositories/graph/graph.repository.ts
import { BaseRepository } from '../base.repository';
import type { NetworkCanvasInput } from '@contracts/topology';
import type { GraphDTO } from 'topology-shared';
import type { AccessScope } from '@shared/express';

export class GraphRepository extends BaseRepository {
  async getGraph(filters: NetworkCanvasInput | undefined, scope: AccessScope): Promise<GraphDTO> {
    const graphFilters: NetworkCanvasInput = filters ?? {
      whitelistSenders: [],
      whitelistReceivers: [],
      whitelistAssets: [],
      whitelistTransfers: [],
      includeCompletedTransferEvents: false,
    };
    // Each section is its own subquery: a global collect() always yields one row (possibly an empty list),
    // so an empty section can no longer wipe out the rest of the graph.
    const query = `
      CALL {
        MATCH (accessible:Asset)
        WHERE $scopeOrgId IS NULL OR EXISTS {
          MATCH (:Organization {id: $scopeOrgId})-[:HAS_CUSTODY]->(accessible)
        } OR EXISTS {
          MATCH (incoming:TransferEvent)-[inv:INVOLVES]->(accessible)
          MATCH (incoming)-[:DELIVERED_TO]->(:Organization {id: $scopeOrgId})
          WHERE accessible.status = 'IN_TRANSIT'
            AND incoming.status IN ['IN_PROGRESS', 'PARTIALLY_COMPLETED'] AND inv.status = 'IN_TRANSIT'
        }
        RETURN collect(accessible.id) AS accessibleAssetIds
      }

      // Build assets set based on filters
      CALL {
        WITH accessibleAssetIds
        MATCH (a:Asset)
        WHERE a.id IN accessibleAssetIds AND ((
          size($whitelistTransfers) = 0
          AND size($whitelistAssets) = 0
          AND size($whitelistSenders) = 0
          AND size($whitelistReceivers) = 0
        )
        OR (size($whitelistAssets) > 0 AND a.id IN $whitelistAssets)
        OR (
          size($whitelistAssets) = 0
          AND size($whitelistTransfers) > 0
          AND EXISTS {
            MATCH (e:TransferEvent)-[:INVOLVES]->(a)
            WHERE e.requisitionNumber IN $whitelistTransfers OR e.id IN $whitelistTransfers
          }
        )
        OR (
          size($whitelistAssets) = 0
          AND size($whitelistSenders) > 0
          AND EXISTS {
            MATCH (o:Organization)-[:HAS_CUSTODY]->(a)
            WHERE o.id IN $whitelistSenders
          }
        )
        OR (
          size($whitelistAssets) = 0
          AND size($whitelistSenders) > 0
          AND EXISTS {
            MATCH (o:Organization)-[:DELIVERED_FROM]->(e:TransferEvent)-[:INVOLVES { status: 'IN_TRANSIT' }]->(a)
            WHERE o.id IN $whitelistSenders
          }
        )
        OR (
          size($whitelistAssets) = 0
          AND size($whitelistReceivers) > 0
          AND EXISTS {
            MATCH (e:TransferEvent)-[:INVOLVES { status: 'IN_TRANSIT' }]->(a)
            MATCH (e)-[:DELIVERED_TO]->(o:Organization)
            WHERE o.id IN $whitelistReceivers
          }
        ))
        RETURN collect(DISTINCT {
          id: a.id,
          name: a.name,
          nomenclature: a.nomenclature,
          serialNumber: a.serialNumber,
          status: a.status
        }) AS assets
      }

      // Build transfers set based on filters
      CALL {
        WITH accessibleAssetIds
        MATCH (e:TransferEvent)
        WHERE ($includeCompletedTransferEvents OR e.status IN ['IN_PROGRESS', 'PARTIALLY_COMPLETED'])
        AND ($scopeOrgId IS NULL OR EXISTS {
          MATCH (e)-[:INVOLVES]->(accessible:Asset)
          WHERE accessible.id IN accessibleAssetIds
        })
        AND (
          (
            size($whitelistTransfers) = 0
            AND size($whitelistAssets) = 0
            AND size($whitelistSenders) = 0
            AND size($whitelistReceivers) = 0
          )
          OR (size($whitelistTransfers) > 0 AND (e.requisitionNumber IN $whitelistTransfers OR e.id IN $whitelistTransfers))
          OR (
            size($whitelistAssets) > 0
            AND EXISTS {
              MATCH (e)-[:INVOLVES]->(asset:Asset)
              WHERE asset.id IN $whitelistAssets AND asset.id IN accessibleAssetIds
            }
          )
          OR (
            size($whitelistSenders) > 0
            AND NOT (size($whitelistAssets) > 0)
            AND NOT (size($whitelistTransfers) > 0)
            AND EXISTS {
              MATCH (sender:Organization)-[:DELIVERED_FROM]->(e)
              WHERE sender.id IN $whitelistSenders
            }
          )
          OR (
            size($whitelistReceivers) > 0
            AND NOT (size($whitelistAssets) > 0)
            AND NOT (size($whitelistTransfers) > 0)
            AND EXISTS {
              MATCH (e)-[:DELIVERED_TO]->(receiver:Organization)
              WHERE receiver.id IN $whitelistReceivers
            }
          )
        )
        OPTIONAL MATCH (sender:Organization)-[:DELIVERED_FROM]->(e)
        OPTIONAL MATCH (e)-[:DELIVERED_TO]->(receiver:Organization)
        OPTIONAL MATCH (e)-[inv:INVOLVES]->(asset:Asset)
        WHERE asset.id IN accessibleAssetIds
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
        }) AS transfers
      }

      // Include both endpoints of the transfers actually selected above.
      CALL {
        WITH transfers, assets, accessibleAssetIds
        MATCH (o:Organization)
        WHERE ($scopeOrgId IS NULL
          OR (o.id = $scopeOrgId AND size($whitelistAssets) = 0 AND size($whitelistTransfers) = 0)
          OR any(transfer IN transfers WHERE o.id = transfer.senderOrgId OR o.id = transfer.receiverOrgId)
          OR EXISTS {
            MATCH (o)-[:HAS_CUSTODY]->(asset:Asset)
            WHERE asset.id IN accessibleAssetIds AND any(selected IN assets WHERE selected.id = asset.id)
          })
        AND ((
          size($whitelistTransfers) = 0
          AND size($whitelistAssets) = 0
          AND size($whitelistSenders) = 0
          AND size($whitelistReceivers) = 0
        )
        OR (o.id IN $whitelistSenders)
        OR (o.id IN $whitelistReceivers)
        OR any(transfer IN transfers WHERE o.id = transfer.senderOrgId OR o.id = transfer.receiverOrgId)
        OR (
          size($whitelistAssets) > 0
          AND EXISTS {
            MATCH (o)-[:HAS_CUSTODY]->(asset:Asset)
            WHERE asset.id IN $whitelistAssets
          }
        )
        OR (
          size($whitelistAssets) > 0
          AND EXISTS {
            MATCH (o)-[:DELIVERED_FROM|DELIVERED_TO]->(e:TransferEvent)-[:INVOLVES]->(asset:Asset)
            WHERE asset.id IN $whitelistAssets
          }
        )
        OR (
          size($whitelistAssets) > 0
          AND EXISTS {
            MATCH (e:TransferEvent)-[:DELIVERED_TO]->(o)
            MATCH (e)-[:INVOLVES { status: 'IN_TRANSIT' }]->(asset:Asset)
            WHERE asset.id IN $whitelistAssets
          }
        )
        OR (
          size($whitelistTransfers) > 0
          AND EXISTS {
            MATCH (o)-[:DELIVERED_FROM|DELIVERED_TO]->(e:TransferEvent)
            WHERE e.requisitionNumber IN $whitelistTransfers OR e.id IN $whitelistTransfers
          }
        ))
        RETURN collect(DISTINCT {
          id: o.id,
          name: o.name,
          type: o.type,
          addressLine1: o.addressLine1,
          addressLine2: o.addressLine2
        }) AS organizations
      }

      // Build custody links based on filters
      CALL {
        WITH accessibleAssetIds
        MATCH (org:Organization)-[:HAS_CUSTODY]->(ast:Asset)
        WHERE ast.id IN accessibleAssetIds
        AND NOT (
          ()-[:INVOLVES { status: 'IN_TRANSIT' }]->(ast)
        )
        AND (
          (
            size($whitelistTransfers) = 0
            AND size($whitelistAssets) = 0
            AND size($whitelistSenders) = 0
            AND size($whitelistReceivers) = 0
          )
          OR (size($whitelistAssets) > 0 AND ast.id IN $whitelistAssets)
          OR (size($whitelistAssets) = 0 AND org.id IN $whitelistSenders AND size($whitelistReceivers) = 0)
          OR (size($whitelistAssets) = 0 AND org.id IN $whitelistReceivers AND size($whitelistSenders) = 0)
          OR (size($whitelistAssets) = 0 AND org.id IN $whitelistSenders AND org.id IN $whitelistReceivers)
        )
        RETURN collect(DISTINCT {
          orgId: org.id,
          assetId: ast.id
        }) AS custodyLinks
      }

      RETURN {
        organizations: organizations,
        assets: assets,
        transfers: transfers,
        custodyLinks: custodyLinks
      } AS topologyGraph
    `;

    const result = await this.executeReadQuery(
      query,
      { ...graphFilters, scopeOrgId: scope.kind === 'auditor' ? null : scope.orgId },
      (record) => record.get('topologyGraph'),
    );
    const rawGraph = result[0] || {
      organizations: [],
      assets: [],
      transfers: [],
      custodyLinks: [],
    };

    return {
      timestamp: new Date().toISOString(),
      ...rawGraph,
    };
  }
}