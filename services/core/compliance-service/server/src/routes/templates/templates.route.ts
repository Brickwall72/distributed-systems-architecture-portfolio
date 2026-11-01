// File: services/core/compliance-service/server/src/routes/templates/templates.route.ts
import { initServer } from '@ts-rest/express';
import { createLogger } from '@shared/express';
import { templatesRoutes, TemplateDraftResponseSchema, FormId, templateId2dataSchema } from 'compliance-shared';
import { TemplateRepository } from '../../repositories';
import { hydrateTemplate } from '@shared/ui-components';
import { EventBroker } from '@shared/messaging';
import { PDF_SUBJECTS, generatePdfCommandSchema, generatePdfResponseSchema } from '@contracts/pdf';
import { z } from 'zod';

export const templatesRouterDepsSchema = z.object({
  broker: z.instanceof(EventBroker),
})
type TemplatesRouterDeps = z.infer<typeof templatesRouterDepsSchema>;

const logger = createLogger('compliance-server:templates');
const s = initServer();

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

        // 1. Preserve a client-supplied requisition number (links receipts to their authorizations); otherwise generate one
        const bodyObj = (body.data as Record<string, unknown>) || {};
        const suppliedReqNum = typeof bodyObj.requisitionNumber === 'string' ? bodyObj.requisitionNumber.trim() : '';
        const requisitionNumber =
          suppliedReqNum || `REQ-${new Date().getFullYear()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

        // 2. Parse the raw payload with the template's own pipeline (when one is registered)
        const withReqNum = { ...bodyObj, requisitionNumber };
        const pipeline = (templateId2dataSchema as Partial<Record<FormId, z.ZodTypeAny>>)[id];
        const parsed = pipeline ? pipeline.safeParse(withReqNum) : null;
        if (parsed && !parsed.success) {
          return {
            status: 400 as const,
            body: {
              error: `Invalid payload for template [${id}]: ${parsed.error.message}`,
              code: 'BAD_REQUEST',
              timestamp: new Date().toISOString(),
            },
          };
        }
        const inputObj = (bodyObj.input as Record<string, unknown> | undefined) ?? {};
        const hydrationData = parsed?.success
          ? (parsed.data as Record<string, unknown>)
          : { ...withReqNum, input: { ...inputObj, requisitionNumber } };

        // 3. Hydrate template using the validated payload
        const hydratedHtml = hydrateTemplate(template.rawHTML, hydrationData);
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
          requisitionNumber,
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