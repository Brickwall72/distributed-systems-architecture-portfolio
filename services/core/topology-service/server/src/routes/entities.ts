// File: services/core/topology-service/server/src/routes/entities.ts
import { Router, Request, Response } from 'express';
import { createLogger } from '@shared/express';
import { getDatabaseClient } from '../topologyDatabase';

const router = Router();
const logger = createLogger('topology/entities');
const correlationHeader = 'X-Correlation-ID';

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const correlationId = req.header(correlationHeader) || 'UNKNOWN';
  const session = getDatabaseClient().session();

  try {
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

      // 2. Gather all Assets
      MATCH (a:Asset)
      WITH organizations, collect(DISTINCT {
        id: a.id,
        name: a.name,
        nomenclature: a.nomenclature,
        serialNumber: a.serialNumber,
        type: a.type,
        status: a.status
      }) as assets

      // 3. Gather active/in-transit Transfer Events and their links
      MATCH (e:TransferEvent)
      WHERE e.status = 'PARTIALLY_COMPLETED' OR e.status = 'IN_TRANSIT'
      OPTIONAL MATCH (sender:Organization)-[:DELIVERED_FROM]->(e)
      OPTIONAL MATCH (e)-[:DELIVERED_TO]->(receiver:Organization)
      OPTIONAL MATCH (e)-[inv:INVOLVES]->(asset:Asset)
      WITH organizations, assets, collect(DISTINCT {
        requisitionNumber: e.requisitionNumber,
        date: e.date,
        type: e.type,
        status: e.status,
        senderOrgId: sender.id,
        senderName: sender.name,
        receiverOrgId: receiver.id,
        receiverName: receiver.name,
        assetId: asset.id,
        assetNomenclature: asset.nomenclature,
        serialNumber: asset.serialNumber,
        invStatus: inv.status
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

    const result = await session.executeRead((tx) => tx.run(query));
    const rawData = result.records[0]?.get('topologyGraph') || {
      organizations: [],
      assets: [],
      activeTransfers: [],
      custodyLinks: []
    };

    res.status(200).json({
      timestamp: new Date().toISOString(),
      ...rawData
    });
  } catch (caughtError: unknown) {
    logger.error(`Topology graph data extraction failed: ${String(caughtError)}`, correlationId);
    res.status(500).json({
      errorCode: 'TOPOLOGY_ENTITY_QUERY_FAILURE',
      message: 'The topology graph engine could not cleanly enumerate network nodes.',
      timestamp: new Date().toISOString()
    });
  } finally {
    await session.close();
  }
});

export { router as entitiesRouter };