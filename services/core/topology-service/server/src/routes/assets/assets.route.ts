// File: services/core/topology-service/server/src/routes/assets/assets.route.ts
import { initServer } from '@ts-rest/express';
import type { AssetDTOList } from '@contracts/topology';
import { assetsRoutes } from 'topology-shared';
import { AssetsRepository } from '../../repositories';
import { assetEntityToDTO } from '../../mappers';
import { getDatabaseClient } from '../../topologyDatabase';
import { createLogger } from '@shared/express';

const logger = createLogger('topology/assets');
const s = initServer();

export function createAssetsRouter(repository?: AssetsRepository) {
  const assetRepository = repository ?? new AssetsRepository(getDatabaseClient());

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
    createAsset: async ({ body }) => {
      try {
        const entity = await assetRepository.createAsset(body);
        const dto = assetEntityToDTO(entity);

        return {
          status: 201,
          body: dto,
        };
      } catch (error: unknown) {
        logger.error(`Failed to create asset: ${error}`);
        return {
          status: 500,
          body: {
            error: 'Internal server error while creating asset',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}