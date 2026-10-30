// File: services/core/topology-service/server/src/routes/assets/assets.route.unit.test.ts
import { AssetDTOListSchema, AssetDTOSchema } from '@contracts/topology';
import { mockFromSchema } from '@shared/testing';
import { assetEntitySchema } from '../../domain';
import { createAssetsRouter } from './assets.route';
import type { AssetsRepository } from '../../repositories';

describe('createAssetsRouter (API Boundary Handler)', () => {
  let mockRepository: Partial<AssetsRepository>;

  beforeEach(() => {
    mockRepository = {
      findAssets: vi.fn(),
      createAsset: vi.fn(),
    };
  });

  describe('getAssets', () => {
    it('returns HTTP 200 with contract-compliant AssetDTO array when query succeeds', async () => {
      const mockEntities = [
        mockFromSchema(assetEntitySchema, { currentOwnerId: 'org-10' }),
        mockFromSchema(assetEntitySchema, { currentOwnerId: 'org-10' }),
      ];

      vi.mocked(mockRepository.findAssets!).mockResolvedValue(mockEntities);

      const router = createAssetsRouter(mockRepository as AssetsRepository);

      // Directly invoke the ts-rest handler method
      const response = await router.getAssets({
        query: { filterOwnerId: 'org-10', includeInTransit: false },
        headers: {} as any,
        req: {} as any,
        res: {} as any,
      });

      // 1. Verify HTTP Response shape
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);

      // 2. DevSecOps Boundary Check: Explicitly validate mapped response body against Zod DTO schema
      const parsedBody = AssetDTOListSchema.safeParse(response.body);
      expect(parsedBody.success).toBe(true);

      // 3. Verify repository receives all query parameters sent through the request
      expect(mockRepository.findAssets).toHaveBeenCalledWith({ filterOwnerId: 'org-10', includeInTransit: false });
    });

    it('catches repository exceptions and returns sanitized HTTP 500 error payload matching schema', async () => {
      vi.mocked(mockRepository.findAssets!).mockRejectedValue(
        new Error('Neo4j cluster quorum lost')
      );

      const router = createAssetsRouter(mockRepository as AssetsRepository);

      const response = await router.getAssets({
        query: { includeInTransit: false },
        headers: {} as any,
        req: {} as any,
        res: {} as any,
      });

      // DevSecOps Check: Verify error payload matches ApiErrorResponseSchema without leaking stack trace
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal server error while fetching assets',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: expect.any(String),
      });
    });
  });

  describe('createAsset', () => {
    it('returns HTTP 201 with contract-compliant AssetDTO when creation succeeds', async () => {
      const requestBody = mockFromSchema(AssetDTOSchema, { name: 'GPS Navigation Unit', currentOwnerId: 'org-10' });
      const createdEntity = mockFromSchema(assetEntitySchema, { id: requestBody.id, nomenclature: 'GPS-III' });

      vi.mocked(mockRepository.createAsset!).mockResolvedValue(createdEntity);

      const router = createAssetsRouter(mockRepository as AssetsRepository);

      const response = await router.createAsset({
        body: requestBody,
        headers: {} as any,
        files: undefined,
        file: undefined,
        req: {} as any,
        res: {} as any,
      });

      expect(response.status).toBe(201);

      const parsedBody = AssetDTOSchema.safeParse(response.body);
      expect(parsedBody.success).toBe(true);
      expect(response.body).toEqual({ ...createdEntity, name: 'GPS-III' });
      expect(mockRepository.createAsset).toHaveBeenCalledTimes(1);
    });

    it('catches repository exceptions on create and returns sanitized HTTP 500', async () => {
      vi.mocked(mockRepository.createAsset!).mockRejectedValue(
        new Error('Neo4j constraint violation')
      );

      const router = createAssetsRouter(mockRepository as AssetsRepository);

      const response = await router.createAsset({
        body: mockFromSchema(AssetDTOSchema, { name: 'GPS Navigation Unit', currentOwnerId: 'org-10' }),
        headers: {} as any,
        files: undefined,
        file: undefined,
        req: {} as any,
        res: {} as any,
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal server error while creating asset',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: expect.any(String),
      });
    });
  });
});