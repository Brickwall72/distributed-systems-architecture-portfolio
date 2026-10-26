// File: services/core/topology-service/server/src/routes/graph/graph.route.ts
import { initServer } from '@ts-rest/express';
import { graphRoutes } from 'topology-shared';
import { GraphRepository } from '../../repositories';
import { getDatabaseClient } from '../../database';
import { createLogger } from '@shared/express';

const logger = createLogger('topology/graph');
const s = initServer();

export function createGraphRouter(repository?: GraphRepository) {
  const graphRepository = repository ?? new GraphRepository(getDatabaseClient());

  return s.router(graphRoutes, {
    getGraph: async () => {
      try {
        const graphData = await graphRepository.getGraph();
        return {
          status: 200,
          body: graphData,
        };
      } catch (error: unknown) {
        logger.error(`Topology graph data extraction failed: ${String(error)}`);
        return {
          status: 500,
          body: {
            error: 'The topology graph engine could not cleanly enumerate network nodes.',
            code: 'TOPOLOGY_ENTITY_QUERY_FAILURE',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}