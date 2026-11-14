// File: services/core/compliance-service/server/src/routes/templates/templates.route.ts
import { initServer } from '@ts-rest/express';
import { createLogger, orgScope } from '@shared/express';
import { templatesRoutes, TemplateDraftResponseSchema, FormId, FORM_TYPE, templateId2dataSchema } from 'compliance-shared';
import { TemplateRepository, draftBindingSchema, type DocumentsRepository } from '../../repositories';
import { hydrateTemplate } from '@shared/utils';
import type { EventBroker } from '@shared/messaging';
import { PDF_SUBJECTS, generatePdfCommandSchema, generatePdfResponseSchema } from '@contracts/pdf';
import { z } from 'zod';
import { TopologyConflict, TopologyUnavailable, type TopologyNatsClient } from '../../messaging/topology';
import { draftInputSchema, type DraftPreparation } from './draft.schema';

export interface TemplatesRouterDeps {
  broker: Pick<EventBroker, 'request'>;
  repository: Pick<DocumentsRepository, 'findTransferParticipants' | 'saveDraftBinding'>;
  topology: Pick<TopologyNatsClient, 'validateDraft'>;
}

const logger = createLogger('compliance-server:templates');
const s = initServer();
type DraftTemplate = NonNullable<ReturnType<typeof TemplateRepository.findById>>;

function draftError(status: 400 | 403 | 409 | 503, error: string, code: string): DraftPreparation {
  return { success: false, status, body: { error, code, timestamp: new Date().toISOString() } };
}

async function validateReceiptTransfer(
  template: DraftTemplate,
  sourceOrgId: string,
  targetOrgId: string,
  transferEventId: string | undefined,
  suppliedReqNum: string,
  requisitionNumber: string,
  repository: TemplatesRouterDeps['repository'],
): Promise<DraftPreparation | undefined> {
  if (template.type !== FORM_TYPE.RECEIPT) return undefined;
  if (!transferEventId || !suppliedReqNum) {
    return draftError(400, 'Receipt requires a transfer and requisition', 'BAD_REQUEST');
  }
  const participants = await repository.findTransferParticipants(transferEventId, requisitionNumber);
  if (!participants) {
    return draftError(409, 'Transfer participants are not available', 'TRANSFER_NOT_READY');
  }
  if (participants.senderOrgId !== sourceOrgId || participants.receiverOrgId !== targetOrgId) {
    return draftError(403, 'Receipt parties do not match the transfer', 'FORBIDDEN');
  }
  return undefined;
}

function validateDraftOrganizations(
  template: DraftTemplate,
  sourceOrgId: string,
  targetOrgId: string,
  assetIds: string[],
  creatorOrgId: string,
): DraftPreparation | undefined {
  if (sourceOrgId === targetOrgId || new Set(assetIds).size !== assetIds.length) {
    return draftError(400, 'Draft requires distinct assets and both organizations', 'BAD_REQUEST');
  }
  if ((template.type === FORM_TYPE.AUTHORIZATION && sourceOrgId !== creatorOrgId)
    || (template.type === FORM_TYPE.RECEIPT && targetOrgId !== creatorOrgId)) {
    return draftError(403, 'Draft requires the applicable transfer organization', 'FORBIDDEN');
  }
  return undefined;
}

async function prepareDraft(
  template: DraftTemplate,
  bodyObj: Record<string, unknown>,
  creatorOrgId: string,
  repository: TemplatesRouterDeps['repository'],
  topology: TemplatesRouterDeps['topology'],
): Promise<DraftPreparation> {
  const parsedInput = draftInputSchema.safeParse(bodyObj);
  if (!parsedInput.success) {
    return draftError(400, 'Draft requires distinct assets and both organizations', 'BAD_REQUEST');
  }

  const { sourceOrg, targetOrg, assets, transferEventId } = parsedInput.data;
  const assetIds = assets.map((asset) => asset.id);
  const organizationError = validateDraftOrganizations(template, sourceOrg.id, targetOrg.id, assetIds, creatorOrgId);
  if (organizationError) return organizationError;

  const suppliedReqNum = typeof bodyObj.requisitionNumber === 'string' ? bodyObj.requisitionNumber.trim() : '';
  if (suppliedReqNum.length > 100) return draftError(400, 'Requisition number must be at most 100 characters', 'BAD_REQUEST');
  const requisitionNumber = suppliedReqNum
    || `REQ-${new Date().getFullYear()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

  const receiptError = await validateReceiptTransfer(
    template,
    sourceOrg.id,
    targetOrg.id,
    transferEventId,
    suppliedReqNum,
    requisitionNumber,
    repository,
  );
  if (receiptError) {
    return receiptError;
  }

  let facts;
  try {
    facts = await topology.validateDraft({
      senderOrgId: sourceOrg.id,
      receiverOrgId: targetOrg.id,
      requisitionNumber,
      transferType: template.transferType,
      operation: template.type,
      transferEventId,
      assetIds,
    });
  } catch (error: unknown) {
    if (error instanceof TopologyConflict) return draftError(409, 'Transfer state is no longer available', 'TRANSFER_CONFLICT');
    if (error instanceof TopologyUnavailable) return draftError(503, 'Topology service is unavailable', 'TOPOLOGY_UNAVAILABLE');
    throw error;
  }
  const withReqNum = {
    ...bodyObj, requisitionNumber,
    sourceOrg: facts.sender, targetOrg: facts.receiver, assets: facts.assets,
  };
  const pipeline = (templateId2dataSchema as Partial<Record<FormId, z.ZodTypeAny>>)[template.id as FormId];
  const parsedPayload = pipeline?.safeParse(withReqNum);
  if (parsedPayload && !parsedPayload.success) {
    return draftError(400, `Invalid payload for template [${template.id}]: ${parsedPayload.error.message}`, 'BAD_REQUEST');
  }

  const inputObj = (bodyObj.input as Record<string, unknown> | undefined) ?? {};
  const hydrationData = parsedPayload?.success
    ? parsedPayload.data as Record<string, unknown>
    : { ...withReqNum, input: { ...inputObj, requisitionNumber } };

  return {
    success: true,
    requisitionNumber,
    hydrationData,
    sourceOrgId: sourceOrg.id,
    targetOrgId: targetOrg.id,
    assetIds,
    transferEventId,
  };
}

export function createTemplatesRouter(deps: TemplatesRouterDeps) {
  return s.router(templatesRoutes, {
    // eslint-disable-next-line @typescript-eslint/require-await
    getTemplates: async ({ query, req }) => {
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      logger.info('Fetching compliance template manifest', correlationId);

      try {
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
        const templateRecord = TemplateRepository.findById(id as FormId);

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

    createTemplateDraft: async ({ params: { id }, body, req }) => {
      const correlationId = (req.headers['x-correlation-id'] as string) || null;
      if (!req.identity) {
        return {
          status: 401 as const,
          body: { error: 'Authentication required', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() },
        };
      }
      const creatorOrgId = orgScope(req.identity);
      if (typeof creatorOrgId !== 'string') {
        return {
          status: 403 as const,
          body: { error: 'Draft creation requires an organization member', code: 'FORBIDDEN', timestamp: new Date().toISOString() },
        };
      }
      req.res?.setHeader('Cache-Control', 'no-store');
      logger.info(`Generating draft PDF for template [${id}]`, correlationId);

      try {
        const template = TemplateRepository.findById(id);
        if (!template) {
          return {
            status: 404 as const,
            body: {
              error: `Template [${id}] not found.`,
              code: 'NOT_FOUND',
              timestamp: new Date().toISOString(),
            },
          };
        }

        const bodyObj = (body.data as Record<string, unknown>) || {};
        const draft = await prepareDraft(template, bodyObj, creatorOrgId, deps.repository, deps.topology);
        if (!draft.success) return draft;

        const hydratedHtml = hydrateTemplate(template.rawHTML, draft.hydrationData);
        const documentId = crypto.randomUUID();
        
        const broker = deps.broker;
        if (!broker) {
          throw new Error('EventBroker dependency is not available');
        }

        const documentData = {
          documentId,
          documentName: template.id,
          documentType: template.type,
          transferType: template.transferType,
          requisitionNumber: draft.requisitionNumber,
          customPath: 'compliance/drafts',
          html: hydratedHtml,
        };

        const pdfResponse = generatePdfResponseSchema.parse(await broker.request(
          PDF_SUBJECTS.GENERATE_PDF,
          generatePdfCommandSchema.parse(documentData),
          { correlationId: correlationId || undefined, timeout: 15000 }
        ));

        if (!pdfResponse.success) {
          throw new Error('PDF generator service returned an unsuccessful response status');
        }
        const binding = draftBindingSchema.parse({
          ...documentData,
          ...pdfResponse,
          senderOrgId: draft.sourceOrgId,
          receiverOrgId: draft.targetOrgId,
          assetIds: draft.assetIds,
          transferEventId: draft.transferEventId,
        });
        await deps.repository.saveDraftBinding(binding, req.identity.sub, creatorOrgId);
        logger.info(`Successfully obtained pre-signed PDF URL via NATS for document [${documentData.documentId}]`, correlationId);

        // 4. Return the storage artifact along with the authoritative requisition number to the client
        return {
          status: 201 as const,
          body: TemplateDraftResponseSchema.parse({
            ...documentData,
            ...pdfResponse,
          }),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;

        logger.error(`Failed to create template draft PDF: ${message}`, correlationId);

        return {
          status: 500 as const,
          body: {
            error: message,
            code: 'INTERNAL_SERVER_ERROR',
            details: stack ? [stack] : undefined,
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}