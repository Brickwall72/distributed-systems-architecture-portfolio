// File: services/core/topology-service/src/topologyGateway.ts

import { Router, Request, Response } from 'express';
import neo4j from 'neo4j-driver';
import { createLogger } from '@shared/telemetry';
import { getDatabaseClient } from './topologyDatabase.js';
import {
  AuthorizationRequestPayload,
  AuthorizationResponsePayload,
  EntityDirectoryResponsePayload,
  CustodyTransferRecord
} from '@shared/interfaces';

const router = Router();
const logger = createLogger('topology-service');

const correlationHeader = 'X-Correlation-ID';

/**
 * Core Graph Authorization Check (Space Custody Transfer Gate)
 * Evaluates whether a transferring organization holds valid custody of an asset 
 * prior to executing a formal transfer to a receiving entity.
 */
router.post(
  '/authorizations',
  async (
    req: Request<Record<string, never>, any, AuthorizationRequestPayload>,
    res: Response
  ): Promise<void> => {
    const correlationId = req.header(correlationHeader);
    const timestamp = new Date().toISOString();

    // 1. Priority Traceability Guard Validation Pass
    if (!correlationId || correlationId.trim().length === 0) {
      res.status(400).json({
        errorCode: 'MISSING_CORRELATION_TOKEN',
        message: 'The authorization request lacks a valid correlation identifier for traceability.',
        correlationId: 'UNKNOWN',
        timestamp
      });
      return;
    }

    const payload = req.body;
    const isPayloadValid =
      payload &&
      typeof payload.senderOrgId === 'string' &&
      typeof payload.receiverOrgId === 'string' &&
      typeof payload.assetId === 'string' &&
      (payload.actionContext === 'CUSTODY_TRANSFER' || payload.actionContext === 'PROPERTY_HANDOVER');

    // 2. Strict Boundary Schema Compliance Checker Pass
    if (!isPayloadValid) {
      res.status(400).json({
        errorCode: 'SCHEMA_VALIDATION_FAILURE',
        message: 'The request body does not match the space custody authorization contract.',
        correlationId,
        timestamp
      });
      return;
    }

    const session = getDatabaseClient().session();

    try {
      // Cypher query validating that the sender organization currently holds custody of the asset
      const query = `
        MATCH (sender:Organization { id: $senderOrgId })
        MATCH (receiver:Organization { id: $receiverOrgId })
        MATCH (asset:Asset { id: $assetId })
        MATCH (sender)-[custody:HAS_CUSTODY]->(asset)
        RETURN count(custody) AS authorizedCount
      `;

      const result = await session.executeRead((tx) =>
        tx.run(query, {
          senderOrgId: payload.senderOrgId,
          receiverOrgId: payload.receiverOrgId,
          assetId: payload.assetId,
          actionContext: payload.actionContext
        })
      );

      const rawCount = result.records[0]?.get('authorizedCount');
      const authorizedCount = neo4j.int(rawCount ?? 0).toNumber();
      const isAuthorized = authorizedCount > 0;

      const responsePayload: AuthorizationResponsePayload = {
        status: isAuthorized ? 'AUTHORIZED' : 'DENIED',
        correlationId,
        timestamp,
        message: isAuthorized
          ? 'Custody transfer authorization granted under current graph state.'
          : 'Authorization denied: Transferring organization does not possess current custody of the specified asset.'
      };

      logger.info(
        `Structural custody verification evaluated to [${responsePayload.status}] for Context [${payload.actionContext}]`,
        correlationId
      );

      res.status(200).json(responsePayload);
    } catch (caughtError: unknown) {
      logger.error(
        `Topology authorization path traversal query failed on active graph node: ${String(caughtError)}`,
        correlationId
      );
      res.status(500).json({
        errorCode: 'TOPOLOGY_VALIDATION_FAILURE',
        message: 'The topology graph engine could not evaluate the custody authorization request.',
        correlationId,
        timestamp
      });
    } finally {
      await session.close();
    }
  }
);

/**
 * Returns a detailed directory of historical custody transfers and active asset linkages 
 * matching the DD-1149 event model structure.
 */
router.get('/entities', async (req: Request, res: Response): Promise<void> => {
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

export { router as topologyGateway };