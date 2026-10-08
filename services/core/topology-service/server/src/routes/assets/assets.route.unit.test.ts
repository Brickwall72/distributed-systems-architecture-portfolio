// File: services/core/topology-service/server/src/routes/assets/assets.unit.test.ts
import { AssetDTOListSchema, AssetEntity } from 'topology-shared';
import { createAssetsRouter } from './assets.route';
import type { AssetsRepository } from '../../repositories';
describe('createAssetsRouter (API Boundary Handler)', () => {
  let mockRepository: Partial<AssetsRepository>;

  beforeEach(() => {
    mockRepository = {
      findAssets: vi.fn(),
    };
  });

  it('returns HTTP 200 with contract-compliant AssetDTO array when query succeeds', async () => {
    const mockEntities: AssetEntity[] = [
      {
        id: 'ast-001',
        nomenclature: 'Tactical Radio',
        serialNumber: 'SN-881',
        currentOwnerId: 'org-10',
      },
      {
        id: 'ast-002',
        nomenclature: 'Satellite Terminal',
        serialNumber: 'SN-882',
      },
    ];

    vi.mocked(mockRepository.findAssets!).mockResolvedValue(mockEntities);

    const router = createAssetsRouter(mockRepository as AssetsRepository);

    // Directly invoke the ts-rest handler method
    const response = await router.getAssets({
      query: { filterOwnerId: 'org-10' },
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

    // 3. Verify repository receives normalized filter argument
    expect(mockRepository.findAssets).toHaveBeenCalledWith({ filterOwnerId: 'org-10' });
  });

  it('catches repository exceptions and returns sanitized HTTP 500 error payload matching schema', async () => {
    vi.mocked(mockRepository.findAssets!).mockRejectedValue(
      new Error('Neo4j cluster quorum lost')
    );

    const router = createAssetsRouter(mockRepository as AssetsRepository);

    const response = await router.getAssets({
      query: {},
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