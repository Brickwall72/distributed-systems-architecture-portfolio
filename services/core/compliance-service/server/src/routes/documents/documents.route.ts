// File: services/core/compliance-service/server/src/routes/documents/documents.route.ts
import { initServer } from '@ts-rest/express';
import { accessScope, createLogger, orgScope } from '@shared/express';
import { documentsRoutes, DocumentSchema, FORM_TYPE } from 'compliance-shared';
import {
  draftBindingMatches, draftBindingSchema, SigningRequestConflict,
  type DocumentsRepository, type SigningOperationsRepository,
} from '../../repositories';
import { SignDocumentCommandSchema } from '@contracts/esign';
import { transferClaimSchema } from '@contracts/topology';
import { TopologyConflict, TopologyUnavailable } from '../../messaging/topology';
import type { NatsSigningCoordinator } from '../../services';
import { getSignedDownloadUrlRequestSchema, type GetSignedDownloadUrlRequest } from '@shared/filestore';

export interface DocumentsRouterDeps {
  repository: Pick<DocumentsRepository, 'findAll' | 'findById' | 'findTransferParticipants' | 'findDraftBinding'>;
  signingOperations: Pick<SigningOperationsRepository, 'enqueue' | 'find'>;
  signingCoordinator: Pick<NatsSigningCoordinator, 'processNext'>;
  getSignedDownloadUrl: (request: GetSignedDownloadUrlRequest) => Promise<string>;
}

const logger = createLogger('compliance-server:documents');
const s = initServer();

export function createDocumentsRouter(deps: DocumentsRouterDeps) {
  return s.router(documentsRoutes, {
    getDocuments: async ({ req, query }) => {
      if (!req.identity) {
        return { status: 401 as const, body: { error: 'Authentication required', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() } };
      }
      const scope = accessScope(req.identity);
      if (!scope) {
        return { status: 403 as const, body: { error: 'Organization access required', code: 'FORBIDDEN', timestamp: new Date().toISOString() } };
      }
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.debug('Retrieving all compliance records from database.', correlationId);
      const { repository } = deps;

      try {
        const documents = await repository.findAll({ statuses: query?.status, requisitionNumbers: query?.requisitionNumbers }, scope);
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
      if (!req.identity) {
        return { status: 401 as const, body: { error: 'Authentication required', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() } };
      }
      const scope = accessScope(req.identity);
      if (!scope) {
        return { status: 403 as const, body: { error: 'Organization access required', code: 'FORBIDDEN', timestamp: new Date().toISOString() } };
      }
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.debug(`Retrieving document record for ID: ${id}`, correlationId);
      const { repository } = deps;

      try {
        const document = await repository.findById(id, scope);

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
    getDocumentContentById: async ({ params: { id }, req }) => {
      if (!req.identity) {
        return { status: 401 as const, body: { error: 'Authentication required', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() } };
      }
      const scope = accessScope(req.identity);
      if (!scope) {
        return { status: 403 as const, body: { error: 'Organization access required', code: 'FORBIDDEN', timestamp: new Date().toISOString() } };
      }
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.debug(`Retrieving document content for ID: ${id}`, correlationId);
      req.res?.setHeader('Cache-Control', 'no-store');
      const { repository } = deps;

      try {
        const document = await repository.findById(id, scope);

        if (!document?.storageBucket || !document?.storageKey) {
          return {
            status: 404 as const,
            body: {
              error: `Document with ID '${id}' was not found or does not have storageBucket and/or storageKey.`,
              code: 'NOT_FOUND',
              timestamp: new Date().toISOString(),
            },
          };
        }

        const presignedUrl = await deps.getSignedDownloadUrl(getSignedDownloadUrlRequestSchema.parse(document));

        return { status: 200 as const, body: { presignedUrl } };
      } catch (error) {
        const errorType = error instanceof Error ? error.name : 'Unknown error';
        logger.error(`Failed to retrieve document content in GET /documents/:id/content: ${errorType}`, correlationId);
        return {
          status: 500 as const,
          body: {
            error: 'Internal server error retrieving document content.',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },

    signDocument: async ({ body: requestBody, req }) => {
      if (!req.identity) {
        return {
          status: 401 as const,
          body: { error: 'Authentication required', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() },
        };
      }
      const signerOrgId = orgScope(req.identity);
      if (typeof signerOrgId !== 'string') {
        return {
          status: 403 as const,
          body: { error: 'Signing requires an organization member', code: 'FORBIDDEN', timestamp: new Date().toISOString() },
        };
      }
      const body = { ...requestBody, signerId: req.identity.signerId };
      if (!body.signerId || body.signerId.length > 100) {
        return {
          status: 400 as const,
          body: { error: 'Invalid signer identity', code: 'BAD_REQUEST', timestamp: new Date().toISOString() },
        };
      }
      if (body.documentType === FORM_TYPE.AUTHORIZATION && body.senderOrgId !== signerOrgId) {
        return {
          status: 403 as const,
          body: { error: 'Authorization requires the sender organization', code: 'FORBIDDEN', timestamp: new Date().toISOString() },
        };
      }
      const correlationId = (req.headers['x-correlation-id'] as string);
      logger.debug(`Dispatching NATS signature command for document ID: ${body.documentId}`, correlationId);
      const { repository, signingOperations, signingCoordinator } = deps;

      const validateReceipt = async () => {
        if (body.documentType !== FORM_TYPE.RECEIPT) return null;
        if (!body.transferEventId) {
          return {
            status: 400 as const,
            body: {
              error: 'transferEventId is required to sign a receipt document.',
              code: 'BAD_REQUEST',
              timestamp: new Date().toISOString(),
            },
          };
        }

        const participants = await repository.findTransferParticipants(body.transferEventId, body.requisitionNumber);
        if (!participants) {
          return {
            status: 409 as const,
            body: { error: 'Transfer participants are not available', code: 'TRANSFER_NOT_READY', timestamp: new Date().toISOString() },
          };
        }
        if (participants.receiverOrgId !== signerOrgId
          || participants.senderOrgId !== body.senderOrgId || participants.receiverOrgId !== body.receiverOrgId) {
          return {
            status: 403 as const,
            body: { error: 'Receipt requires the transfer receiver', code: 'FORBIDDEN', timestamp: new Date().toISOString() },
          };
        }
        return null;
      };

      const hasMatchingDraft = async () => {
        const draft = await repository.findDraftBinding(body.documentId, req.identity!.sub, signerOrgId);
        const requestedBinding = draftBindingSchema.safeParse(body);
        return Boolean(draft && requestedBinding.success && draftBindingMatches(draft, requestedBinding.data));
      };

      try {
        const receiptError = await validateReceipt();
        if (receiptError) return receiptError;

        if (!await hasMatchingDraft()) {
          return {
            status: 409 as const,
            body: { error: 'Draft does not match the signing request', code: 'DRAFT_CONFLICT', timestamp: new Date().toISOString() },
          };
        }
        const parsedClaim = transferClaimSchema.safeParse({
          ...body, draftHash: body.fileHash, creatorId: req.identity.sub, templateId: body.documentName,
          signerOrgId, operation: body.documentType,
        });
        if (!parsedClaim.success) {
          return {
            status: 409 as const,
            body: { error: 'Draft does not describe a valid transfer', code: 'DRAFT_CONFLICT', timestamp: new Date().toISOString() },
          };
        }
        const claim = parsedClaim.data;
        const command = SignDocumentCommandSchema.parse({ ...body, customPath: `compliance/transfers/${body.documentType}` });
        await signingOperations.enqueue(claim, command);
        await signingCoordinator.processNext(body.documentId);
        const operation = await signingOperations.find(body.documentId);
        if (operation?.state === 'CONFLICT') {
          return {
            status: 409 as const,
            body: { error: 'Transfer state is no longer available', code: 'TRANSFER_CONFLICT', timestamp: new Date().toISOString() },
          };
        }
        if (operation?.state !== 'COMPLETED') {
          return {
            status: 503 as const,
            body: { error: 'Signing is being reconciled; retry the same request', code: 'SIGNING_PENDING', timestamp: new Date().toISOString() },
          };
        }
        const document = await repository.findById(body.documentId, { kind: 'organization', orgId: signerOrgId });
        if (!document) throw new Error('Completed signed document is not available');
        const presignedUrl = await deps.getSignedDownloadUrl(getSignedDownloadUrlRequestSchema.parse(document));
        req.res?.setHeader('Cache-Control', 'no-store');
        return { status: 200 as const, body: { presignedUrl } };
      } catch (error) {
        logger.error(`Signature request failed in POST /documents/sign: ${error}`, correlationId);
        switch (true) {
          case error instanceof SigningRequestConflict:
            return {
              status: 409 as const,
              body: { error: 'A different signing request already exists for this draft', code: 'SIGNING_REQUEST_CONFLICT', timestamp: new Date().toISOString() },
            };
          case error instanceof TopologyConflict:
            return {
              status: 409 as const,
              body: { error: 'Signing request conflicts with the transfer state', code: 'TRANSFER_CONFLICT', timestamp: new Date().toISOString() },
            };
          case error instanceof TopologyUnavailable:
            return {
              status: 503 as const,
              body: { error: 'Topology service is unavailable; signing will be retried', code: 'TOPOLOGY_UNAVAILABLE', timestamp: new Date().toISOString() },
            };
          default:
            return {
              status: 500 as const,
              body: {
                error: 'Signing failed or is pending reconciliation; retry the same request.',
                code: 'SIGNATURE_PROCESSING_FAILED',
                timestamp: new Date().toISOString(),
              },
            };
        }
      }
    },
  });
}