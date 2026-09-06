// File: services/core/topology-service/server/src/routes/authorizations.ts
import { Router, Request, Response } from 'express';
import neo4j from 'neo4j-driver';
import { createLogger } from '@shared/telemetry';
import { getDatabaseClient } from '../topologyDatabase.js';
import {
  AuthorizationRequestPayload,
  AuthorizationResponsePayload,
} from '@shared/interfaces';

const router = Router();
const logger = createLogger('topology/authorizations');
const correlationHeader = 'X-Correlation-ID';

router.post(
  '/',
  async (
    req: Request<Record<string, never>, any, AuthorizationRequestPayload>,
    res: Response
  ): Promise<void> => {
    const correlationId = req.header(correlationHeader);
    const timestamp = new Date().toISOString();

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

export { router as authorizationsRouter };