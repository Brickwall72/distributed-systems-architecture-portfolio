// File: services/core/topology-service/server/src/routes/organizations/organizations.unit.test.ts
import { OrganizationDTOListSchema } from '@contracts/topology';
import { createOrganizationsRouter } from './organizations.route';
import type { OrganizationsRepository } from '../../repositories';
import { OrganizationEntity } from '../../domain';

describe('createOrganizationsRouter (API Boundary Handler)', () => {
  let mockRepository: Partial<OrganizationsRepository>;

  beforeEach(() => {
    mockRepository = {
      findOrganizations: vi.fn(),
    };
  });

  it('returns HTTP 200 with contract-compliant OrganizationDTO array when query succeeds', async () => {
    const mockEntities: OrganizationEntity[] = [
      {
        id: 'org-001',
        name: 'Space Systems Command',
        type: 'GOV_AGENCY',
        addressLine1: 'Building 2730',
        addressLine2: 'El Segundo, CA',
      },
      {
        id: 'org-002',
        name: 'General Dynamics',
        type: 'CONTRACTOR',
      },
    ];

    vi.mocked(mockRepository.findOrganizations!).mockResolvedValue(mockEntities);

    const router = createOrganizationsRouter(mockRepository as OrganizationsRepository);

    const response = await router.getOrganizations({
      query: { filterOwnedId: 'asset-99', requireActiveAssets: true },
      headers: {} as any,
      req: {} as any,
      res: {} as any,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);

    const parsedBody = OrganizationDTOListSchema.safeParse(response.body);
    expect(parsedBody.success).toBe(true);

    expect(mockRepository.findOrganizations).toHaveBeenCalledWith({
      filterOwnedId: 'asset-99',
      requireActiveAssets: true,
    });
  });

  it('catches repository exceptions and returns sanitized HTTP 500 error payload matching schema', async () => {
    vi.mocked(mockRepository.findOrganizations!).mockRejectedValue(
      new Error('Neo4j cluster quorum lost')
    );

    const router = createOrganizationsRouter(mockRepository as OrganizationsRepository);

    const response = await router.getOrganizations({
      query: { requireActiveAssets: true },
      headers: {} as any,
      req: {} as any,
      res: {} as any,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal server error while fetching organizations',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: expect.any(String),
    });
  });
});