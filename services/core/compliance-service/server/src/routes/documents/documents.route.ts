// File: services/core/compliance-service/server/src/routes/documents/documents.route.ts
import { initServer } from '@ts-rest/express';
import { createLogger } from '@shared/express';
import { documentsRoutes, TemplateId } from 'compliance-shared';
import { ComplianceDocumentRepository } from '../../repositories';
import { pool } from '../../db';
import { EventBroker } from '@shared/messaging';
import { ESIGN_COMMAND_SUBJECTS, SignDocumentResponseSchema } from '@contracts/esign';

const logger = createLogger('compliance-server:documents');
const s = initServer();
const repository = new ComplianceDocumentRepository(pool);

interface DocumentsRouterDeps {
  broker: EventBroker;
}

export function createDocumentsRouter(deps: DocumentsRouterDeps) {
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

    signDocument: async ({ body, req }) => {
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.debug(`Dispatching NATS signature command for document ID: ${body.documentId}`, correlationId);
      const broker = deps.broker;
      try {
        const responseData = await broker.request(
          ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT,
          { ...body, correlationId },
          { timeout: 10000, correlationId }
        );

        const parsedSignResponse = SignDocumentResponseSchema.parse(responseData);

        if (!parsedSignResponse.success) {
          throw new Error('Remote signature generation failed.');
        }

        const document = await repository.findById(body.documentId);
        
        return {
          status: 200 as const,
          body: {
            ...(document || {
              id: body.documentId,
              documentType: body.documentType as TemplateId,
              storageBucket: parsedSignResponse.storageBucket,
              storageKey: parsedSignResponse.storageKey,
              status: 'SIGNED',
              signerId: body.signerId,
              entityId: body.entityId,
              fileHash: parsedSignResponse.fileHash,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
            presignedUrl: parsedSignResponse.presignedUrl,
          },
        };
      } catch (error) {
        logger.error(`Signature request failed in POST /documents/sign: ${error}`, correlationId);
        return {
          status: 500 as const,
          body: {
            error: error instanceof Error ? error.message : 'Internal server error processing signature.',
            code: 'SIGNATURE_PROCESSING_FAILED',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}