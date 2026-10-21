// File: services/core/topology-service/server/src/routes/assets/assets.route.unit.test.ts
import { AssetDTOListSchema, AssetDTOSchema, type AssetDTO, type AssetDTOList } from '@contracts/topology';
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
      const mockEntities: AssetDTOList = [
        {
          id: 'ast-001',
          name: 'Tactical Radio Unit',
          nomenclature: 'Tactical Radio',
          serialNumber: 'SN-881',
          status: 'AVAILABLE',
          currentOwnerId: 'org-10',
        },
        {
          id: 'ast-002',
          name: 'Satellite Terminal',
          nomenclature: 'Satellite Terminal',
          serialNumber: 'SN-882',
          status: 'AVAILABLE',
          currentOwnerId: 'org-10',
        },
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
      const createdAssetDTO: AssetDTO = {
        id: 'ast-003',
        name: 'GPS-III',
        nomenclature: 'GPS-III',
        serialNumber: 'SN-999',
        status: 'AVAILABLE',
        currentOwnerId: 'org-10',
      };

      vi.mocked(mockRepository.createAsset!).mockResolvedValue(createdAssetDTO);

      const router = createAssetsRouter(mockRepository as AssetsRepository);

      const response = await router.createAsset({
        body: {
          id: 'ast-003',
          name: 'GPS Navigation Unit',
          nomenclature: 'GPS-III',
          serialNumber: 'SN-999',
          status: 'AVAILABLE',
          currentOwnerId: 'org-10',
        },
        headers: {} as any,
        files: undefined,
        file: undefined,
        req: {} as any,
        res: {} as any,
      });

      expect(response.status).toBe(201);

      const parsedBody = AssetDTOSchema.safeParse(response.body);
      expect(parsedBody.success).toBe(true);
      expect(response.body).toEqual(createdAssetDTO);
      expect(mockRepository.createAsset).toHaveBeenCalledTimes(1);
    });

    it('catches repository exceptions on create and returns sanitized HTTP 500', async () => {
      vi.mocked(mockRepository.createAsset!).mockRejectedValue(
        new Error('Neo4j constraint violation')
      );

      const router = createAssetsRouter(mockRepository as AssetsRepository);

      const response = await router.createAsset({
        body: {
          id: 'ast-003',
          name: 'GPS Navigation Unit',
          nomenclature: 'GPS-III',
          serialNumber: 'SN-999',
          status: 'AVAILABLE',
          currentOwnerId: 'org-10',
        },
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