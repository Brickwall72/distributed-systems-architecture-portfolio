// File: services/core/topology-service/server/src/routes/assets/assets.route.ts
import { initServer } from '@ts-rest/express';
import { topologyContract, type AssetDTO } from 'topology-shared';
import { TopologyAssetRepository } from '../../repositories';
import { topologyEntityToDTO } from './asset.dto.mapper';
import { getDatabaseClient } from '../../topologyDatabase';
import { createLogger } from '@shared/express';

const logger = createLogger('topology/assets');
const s = initServer();

export function createAssetsRouter(repository?: TopologyAssetRepository) {
  // Safe: Executes only when called inside server.ts after DB initialization completes
  const assetRepository = repository ?? new TopologyAssetRepository(getDatabaseClient());

  return s.router(topologyContract, {
    getAssets: async ({ query }) => {
      try {
        const domainEntities = await assetRepository.findAssets(query);
        const dtos: AssetDTO[] = domainEntities.map(topologyEntityToDTO);

        return {
          status: 200,
          body: dtos,
        };
      } catch (error: unknown) {
        logger.error(`Failed to fetch assets: ${error}`);

        return {
          status: 500,
          body: { error: 'Internal server error while fetching assets' },
        };
      }
    },
  });
}