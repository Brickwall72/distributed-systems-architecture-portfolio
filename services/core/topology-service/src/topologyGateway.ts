// File: services/core/topology-service/src/topologyGateway.ts

import { Router, Request, Response } from 'express';
import neo4j from 'neo4j-driver';
import { createLogger } from '@shared/telemetry';
import { getDatabaseClient } from './topologyDatabase.js';
import {
  AuthorizationRequestPayload,
  AuthorizationResponsePayload,
  EntityDirectoryResponsePayload,
  TopologyEntityLink
} from './topologySchemas.js';

const router = Router();
const logger = createLogger('topology-service');

const correlationHeader = 'X-Correlation-ID';

/**
 * Core Graph Authorization Check (ICD Section 3.1 Mapping)
 * Evaluates whether a requested flight connection pair satisfies graph logic.
 * Uses strict explicit compiler generic typing to prevent payload parsing layout drift.
 */
router.post(
  '/authorizations',
  async (
    req: Request<Record<string, never>, any, AuthorizationRequestPayload>,
    res: Response
  ): Promise<void> => {
    const correlationId = req.header(correlationHeader);
    const timestamp = new Date().toISOString();

    // 1. REQ-003a Priority Traceability Guard Validation Pass
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
      typeof payload.sourceAssetId === 'string' &&
      typeof payload.targetAssetId === 'string' &&
      (payload.actionContext === 'SQUADRON_HANDOVER' || payload.actionContext === 'CARGO_TRANSFER');

    // 2. Strict Boundary Schema Schema Compliance Checker Pass
    if (!isPayloadValid) {
      res.status(400).json({
        errorCode: 'SCHEMA_VALIDATION_FAILURE',
        message: 'The request body does not match the topology authorization contract.',
        correlationId,
        timestamp
      });
      return;
    }

    const session = getDatabaseClient().session();

    try {
      const query = `
        MATCH (src:Asset { id: $sourceAssetId })
        MATCH (tgt:Asset { id: $targetAssetId })
        MATCH (src)-[rel:AUTHORIZED_PATH { context: $actionContext }]->(tgt)
        RETURN count(rel) AS authorizedCount
      `;

      const result = await session.executeRead((tx) =>
        tx.run(query, {
          sourceAssetId: payload.sourceAssetId,
          targetAssetId: payload.targetAssetId,
          actionContext: payload.actionContext
        })
      );

      // CORRECTED: Safe structural conversion utilizing neo4j's native low-level Integer casting objects
      const rawCount = result.records[0]?.get('authorizedCount');
      const authorizedCount = neo4j.int(rawCount ?? 0).toNumber();
      const isAuthorized = authorizedCount > 0;

      const responsePayload: AuthorizationResponsePayload = {
        status: isAuthorized ? 'AUTHORIZED' : 'DENIED',
        correlationId,
        timestamp,
        message: isAuthorized
          ? 'Route is valid under the current policy graph.'
          : 'No matching authorized path exists for the specified asset pair and action context.'
      };

      logger.info(
        `Structural relationship verification evaluated to [${responsePayload.status}] for Context [${payload.actionContext}]`,
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
        message: 'The topology graph engine could not evaluate the authorization request.',
        correlationId,
        timestamp
      });
    } finally {
      await session.close();
    }
  }
);

/**
 * Returns a flattened inventory of graph links to support UI dropdowns and lightweight topology
 * listings without exposing the raw Neo4j object model to the browser.
 */
router.get('/entities', async (req: Request, res: Response): Promise<void> => {
  // CORRECTED: Added X-Correlation-ID trace mapping to prevent ledger fragmentation during UI dropdown hydration calls
  const correlationId = req.header(correlationHeader) || 'UNKNOWN';
  const session = getDatabaseClient().session();

  try {
    const query = `
      MATCH (src:Asset)-[rel:AUTHORIZED_PATH]->(tgt:Asset)
      RETURN src.id AS sourceAssetId,
             src.label AS sourceLabel,
             tgt.id AS targetAssetId,
             tgt.label AS targetLabel,
             rel.context AS actionContext
      ORDER BY src.label, tgt.label
    `;

    const result = await session.executeRead((tx) => tx.run(query));
    
    const connections: TopologyEntityLink[] = result.records.map((record) => ({
      sourceAssetId: record.get('sourceAssetId'),
      sourceLabel: record.get('sourceLabel'),
      targetAssetId: record.get('targetAssetId'),
      targetLabel: record.get('targetLabel'),
      actionContext: record.get('actionContext')
    }));

    const responsePayload: EntityDirectoryResponsePayload = {
      timestamp: new Date().toISOString(),
      connections
    };

    logger.debug(`Directory inventory data enumerated across [${connections.length}] paths.`, correlationId);
    res.status(200).json(responsePayload);
  } catch (caughtError: unknown) {
    logger.error(`Topology entity catalog extraction loop failed: ${String(caughtError)}`, correlationId);
    res.status(500).json({
      errorCode: 'TOPOLOGY_ENTITY_QUERY_FAILURE',
      message: 'The topology graph engine could not cleanly enumerate asset relationships.',
      timestamp: new Date().toISOString()
    });
  } finally {
    await session.close();
  }
});

export { router as topologyGateway };
