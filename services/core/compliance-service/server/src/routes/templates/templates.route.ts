// File: services/core/compliance-service/server/src/routes/templates/templates.route.ts
import { initServer } from '@ts-rest/express';
import { createLogger } from '@shared/express';
import { templatesRoutes } from 'compliance-shared';
import { TemplateRepository } from '../../repositories';

const logger = createLogger('compliance-server:templates');
const s = initServer();

export function createTemplatesRouter() {
  return s.router(templatesRoutes, {
    // eslint-disable-next-line @typescript-eslint/require-await
    getTemplates: async ({ query, req }) => {
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.info('Fetching compliance template manifest', correlationId);

      try {
        // query is typed as GetTemplatesQuery via ts-rest validation
        const manifest = TemplateRepository.findAllManifests(query);
        return { status: 200 as const, body: manifest };
      } catch (err) {
        logger.error(`Failed to fetch template manifest: ${err}`, correlationId);
        return {
          status: 500 as const,
          body: {
            error: 'Internal server error retrieving template manifest.',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },

    // eslint-disable-next-line @typescript-eslint/require-await
    getTemplate: async ({ params: { id }, req }) => {
      const correlationId = (req.headers['x-correlation-id'] as string) || null;

      try {
        const templateRecord = TemplateRepository.findById(id);

        if (!templateRecord) {
          logger.warn(`Template lookup failed: [${id}] not found`, correlationId);
          return {
            status: 404 as const,
            body: {
              error: `Template [${id}] not found.`,
              code: 'NOT_FOUND',
              timestamp: new Date().toISOString(),
            },
          };
        }

        logger.info(`Serving template DTO for [${id}]`, correlationId);
        return { status: 200 as const, body: templateRecord };
      } catch (err) {
        logger.error(`Error loading template [${id}]: ${err}`, correlationId);
        return {
          status: 500 as const,
          body: {
            error: `Internal server error loading template [${id}].`,
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}