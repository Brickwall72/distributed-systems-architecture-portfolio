// File: services/core/topology-service/server/src/routes/organizations.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createLogger } from '@shared/telemetry';
import { getDatabaseClient } from '../topologyDatabase.js';
import { Organization } from '@contracts/domain';

const router = Router();
const logger = createLogger('topology-service');

const OrgQuerySchema = z.object({
  excludeId: z.string().optional(),
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const queryParams = OrgQuerySchema.safeParse(req.query);
  
  if (!queryParams.success) {
    res.status(400).json({ 
      error: 'Invalid query parameters', 
      details: z.treeifyError(queryParams.error) 
    });
    return;
  }

  const { excludeId } = queryParams.data;
  const session = getDatabaseClient().session();

  try {
    const cypher = `
      MATCH (o:Organization)
      WHERE $excludeId IS NULL OR o.id <> $excludeId
      RETURN o.id AS id, o.name AS name
    `;

    const result = await session.executeRead((tx) => 
      tx.run(cypher, { excludeId: excludeId ?? null })
    );

    const organizations: Organization[] = result.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
    }));

    res.status(200).json(organizations);
  } catch (error: any) {
    logger.error(`Failed to fetch organizations: ${error.message}`);
    res.status(500).json({ error: 'Internal server error while fetching organizations' });
  } finally {
    await session.close();
  }
});

export { router as organizationsRouter };