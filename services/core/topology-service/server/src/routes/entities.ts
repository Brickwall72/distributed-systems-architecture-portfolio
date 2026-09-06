// File: services/core/topology-service/server/src/routes/entities.ts
import { Router, Request, Response } from 'express';
import { createLogger } from '@shared/telemetry';
import { getDatabaseClient } from '../topologyDatabase.js';
import {
  EntityDirectoryResponsePayload,
  CustodyTransferRecord
} from '@shared/interfaces';

const router = Router();
const logger = createLogger('topology-service');
const correlationHeader = 'X-Correlation-ID';

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const correlationId = req.header(correlationHeader) || 'UNKNOWN';
  const session = getDatabaseClient().session();

  try {
    const query = `
      MATCH (sender:Organization)-[:INITIATED]->(event:TransferEvent)-[:DELIVERED_TO]->(receiver:Organization)
      MATCH (event)-[inv:INVOLVES]->(asset:Asset)
      RETURN 
        event.requisitionNumber AS requisitionNumber,
        event.date AS transferDate,
        sender.id AS senderOrgId,
        sender.name AS senderName,
        receiver.id AS receiverOrgId,
        receiver.name AS receiverName,
        asset.id AS assetId,
        asset.nomenclature AS assetNomenclature,
        asset.serialNumber AS serialNumber
      ORDER BY event.date DESC, requisitionNumber
    `;

    const result = await session.executeRead((tx) => tx.run(query));
    
    const transfers: CustodyTransferRecord[] = result.records.map((record) => ({
      requisitionNumber: record.get('requisitionNumber'),
      transferDate: record.get('transferDate'),
      senderOrgId: record.get('senderOrgId'),
      senderName: record.get('senderName'),
      receiverOrgId: record.get('receiverOrgId'),
      receiverName: record.get('receiverName'),
      assetId: record.get('assetId'),
      assetNomenclature: record.get('assetNomenclature'),
      serialNumber: record.get('serialNumber')
    }));

    const responsePayload: EntityDirectoryResponsePayload = {
      timestamp: new Date().toISOString(),
      transfers
    };

    logger.debug(`Directory inventory data enumerated across [${transfers.length}] transfer records.`, correlationId);
    res.status(200).json(responsePayload);
  } catch (caughtError: unknown) {
    logger.error(`Topology entity catalog extraction loop failed: ${String(caughtError)}`, correlationId);
    res.status(500).json({
      errorCode: 'TOPOLOGY_ENTITY_QUERY_FAILURE',
      message: 'The topology graph engine could not cleanly enumerate asset custody records.',
      timestamp: new Date().toISOString()
    });
  } finally {
    await session.close();
  }
});

export { router as entitiesRouter };