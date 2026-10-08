// File: services/core/topology-service/server/src/routes/assets/assets.route.ts
import { initServer } from '@ts-rest/express';
import type { AssetDTOList } from '@contracts/topology';
import { assetsRoutes } from 'topology-shared';
import { AssetsRepository } from '../../repositories';
import { assetEntityToDTO } from './asset.dto.mapper';
import { getDatabaseClient } from '../../topologyDatabase';
import { createLogger } from '@shared/express';

const logger = createLogger('topology/assets');
const s = initServer();

export function createAssetsRouter(repository?: AssetsRepository) {
  // Safe: Executes only when called inside server.ts after DB initialization completes
  const assetRepository = repository ?? new AssetsRepository(getDatabaseClient());

  // ✅ Bind directly to raw assetsRoutes to preserve type inference
  return s.router(assetsRoutes, {
    getAssets: async ({ query }) => {
      try {
        const domainEntities = await assetRepository.findAssets(query);
        const dtos: AssetDTOList = domainEntities.map(assetEntityToDTO);

        return {
          status: 200,
          body: dtos,
        };
      } catch (error: unknown) {
        logger.error(`Failed to fetch assets: ${error}`);

        return {
          status: 500,
          body: {
            error: 'Internal server error while fetching assets',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}