// File: services/core/topology-service/server/src/routes/assets.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createLogger } from '@shared/telemetry';
import { getDatabaseClient } from '../topologyDatabase.js';
import { Asset } from '@contracts/domain';

const router = Router();
const logger = createLogger('topology-service');

const AssetQuerySchema = z.object({
  ownerId: z.string().optional(),
  excludeOwnerId: z.string().optional(), // <--- Add this
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const queryParams = AssetQuerySchema.safeParse(req.query);
  
  if (!queryParams.success) {
    res.status(400).json({ 
      error: 'Invalid query parameters', 
      details: z.treeifyError(queryParams.error) 
    });
    return;
  }

  const { ownerId, excludeOwnerId } = queryParams.data;
  const session = getDatabaseClient().session();

  try {
    const cypher = `
      MATCH (a:Asset)
      WHERE ($ownerId IS NULL OR (a)<-[:HAS_CUSTODY]-(:Organization {id: $ownerId}))
        AND ($excludeOwnerId IS NULL OR NOT (a)<-[:HAS_CUSTODY]-(:Organization {id: $excludeOwnerId}))
      OPTIONAL MATCH (o:Organization)-[:HAS_CUSTODY]->(a)
      RETURN a.id AS id, 
             a.nomenclature AS nomenclature, 
             a.serialNumber AS serialNumber, 
             o.id AS currentOwnerId
    `;

    const result = await session.executeRead((tx) => 
      tx.run(cypher, { 
        ownerId: ownerId ?? null, 
        excludeOwnerId: excludeOwnerId ?? null 
      })
    );

    const assets: Asset[] = result.records.map((record) => ({
      id: record.get('id'),
      nomenclature: record.get('nomenclature'),
      serialNumber: record.get('serialNumber'),
      currentOwnerId: record.get('currentOwnerId') ?? undefined,
    }));

    res.status(200).json(assets);
  } catch (error: any) {
    logger.error(`Failed to fetch assets: ${error.message}`);
    res.status(500).json({ error: 'Internal server error while fetching assets' });
  } finally {
    await session.close();
  }
});

export { router as assetsRouter };