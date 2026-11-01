// File: services/core/compliance-service/server/src/routes/documents/documents.route.ts
import { initServer } from '@ts-rest/express';
import { createLogger } from '@shared/express';
import { documentsRoutes, DocumentSchema, FORM_TYPE } from 'compliance-shared';
import { DocumentsRepository, insertDataSchema } from '../../repositories';
import { EventBroker } from '@shared/messaging';
import { ESIGN_COMMAND_SUBJECTS, SignDocumentCommandSchema, SignDocumentResponseSchema } from '@contracts/esign';
import {
  CompliancePublisher, publishtransferInitiatedDataSchema,
  publishtransferReceivedDataSchema,
} from '../../messaging';
import { z } from 'zod';

export const documentsRouterDepsSchema = z.object({
  broker: z.instanceof(EventBroker),
  publisher: z.instanceof(CompliancePublisher),
  repository: z.instanceof(DocumentsRepository),
})
type DocumentsRouterDeps = z.infer<typeof documentsRouterDepsSchema>;

const logger = createLogger('compliance-server:documents');
const s = initServer();

export function createDocumentsRouter(deps: DocumentsRouterDeps) {
  return s.router(documentsRoutes, {
    getDocuments: async ({ req, query }) => {
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.debug('Retrieving all compliance records from database.', correlationId);
      const { repository } = deps;

      try {
        const documents = await repository.findAll({ statuses: query?.status, requisitionNumbers: query?.requisitionNumbers });
        return { status: 200 as const, body: documents.map(doc => DocumentSchema.parse(doc)) };
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
      const { repository } = deps;

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

        return { status: 200 as const, body: DocumentSchema.parse(document) };
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
      const correlationId = (req.headers['x-correlation-id'] as string);
      logger.debug(`Dispatching NATS signature command for document ID: ${body.documentId}`, correlationId);
      const { broker, publisher, repository } = deps;
      try {
        if (body.documentType === FORM_TYPE.RECEIPT && !body.transferEventId) {
          return {
            status: 400 as const,
            body: {
              error: 'transferEventId is required to sign a receipt document.',
              code: 'BAD_REQUEST',
              timestamp: new Date().toISOString(),
            },
          };
        }

        const responseData = SignDocumentResponseSchema.parse(await broker.request(
          ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT,
          SignDocumentCommandSchema.parse(body),
          { timeout: 10000, correlationId }
        ));

        if (!responseData.success) {
          throw new Error('Remote signature generation failed.');
        }

        // Await upsert indexing before querying repository
        const document = await repository.insert(insertDataSchema.parse({...body, ...responseData, status: 'SIGNED'}));

        if(document.type === FORM_TYPE.AUTHORIZATION){
          const data = publishtransferInitiatedDataSchema.parse({
            ...body,
            ...responseData,
            ...document,
          });
          void publisher.publishTransferInitiated(data, correlationId);
        } else if(document.type === FORM_TYPE.RECEIPT) {
          const data = publishtransferReceivedDataSchema.parse({
            ...body,
            ...responseData,
            ...document,
            transferEventId: document.transferEventId ?? body.transferEventId,
          })
          void publisher.publishTransferReceived(data, correlationId);
        }

        return {
          status: 200 as const,
          body: { presignedUrl: responseData.presignedUrl },
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