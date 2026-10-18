// File: services/core/compliance-service/server/src/routes/documents/documents.route.ts
import { initServer } from '@ts-rest/express';
import { createLogger } from '@shared/express';
import { documentsRoutes } from 'compliance-shared';
import { ComplianceDocumentRepository } from '../../repositories';
import { pool } from '../../db';

const logger = createLogger('compliance-server:documents');
const s = initServer();
const repository = new ComplianceDocumentRepository(pool);

export function createDocumentsRouter() {
  return s.router(documentsRoutes, {
    getDocuments: async ({ req }) => {
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.debug('Retrieving all compliance records from database.', correlationId);

      try {
        const documents = await repository.findAll();
        return { status: 200 as const, body: documents };
      } catch (error) {
        logger.error(`Database query failed in GET /documents: ${error}`, correlationId);
        return {
          status: 500 as const,
          body: {
            error: error instanceof Error ? error.message : 'Internal server error retrieving documents.',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },

    getDocumentById: async ({ params: { id }, req }) => {
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.debug(`Retrieving document record for ID: ${id}`, correlationId);

      try {
        const document = await repository.findById(id);

        if (!document) {
          return {
            status: 404 as const,
            body: {
              error: `Document with ID '${id}' was not found.`,
              code: 'NOT_FOUND',
              timestamp: new Date().toISOString(),
            },
          };
        }

        return { status: 200 as const, body: document };
      } catch (error) {
        logger.error(`Database query failed in GET /documents/:id: ${error}`, correlationId);
        return {
          status: 500 as const,
          body: {
            error: error instanceof Error ? error.message : 'Internal server error retrieving document.',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}