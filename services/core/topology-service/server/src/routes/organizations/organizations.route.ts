// File: services/core/topology-service/server/src/routes/organizations/organizations.route.ts
import { initServer } from '@ts-rest/express';
import { OrganizationDTOList } from '@contracts/topology';
import { organizationsContract } from 'topology-shared';
import { OrganizationsRepository } from '../../repositories';
import { organizationEntityToDTO } from './organization.dto.mapper';
import { getDatabaseClient } from '../../topologyDatabase';
import { createLogger } from '@shared/express';

const logger = createLogger('topology/organizations');
const s = initServer();

export function createOrganizationsRouter(repository?: OrganizationsRepository) {
  // Safe: Executes only when called inside server.ts after DB initialization completes
  const organizationRepository = repository ?? new OrganizationsRepository(getDatabaseClient());

  // Bind directly to organizationsContract, NOT the entire topologyContract
  return s.router(organizationsContract, {
    getOrganizations: async ({ query }) => {
      try {
        const domainEntities = await organizationRepository.findOrganizations(query);
        const dtos: OrganizationDTOList = domainEntities.map(organizationEntityToDTO);

        return {
          status: 200,
          body: dtos,
        };
      } catch (error: unknown) {
        logger.error(`Failed to fetch organizations: ${error}`);

        // Must match ApiErrorResponseSchema defined in @contracts/common
        return {
          status: 500,
          body: {
            error: 'Internal server error while fetching organizations',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}