// File: services/core/compliance-service/server/src/routes/templates/templates.route.ts
import { initServer } from '@ts-rest/express';
import { createLogger } from '@shared/express';
import { templatesRoutes } from 'compliance-shared';
import { TemplateRepository } from '../../repositories';
import { hydrateTemplate } from '@shared/ui-components';

const logger = createLogger('compliance-server:templates');
const s = initServer();

export function createTemplatesRouter() {
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

        const hydratedHtml = hydrateTemplate(template.rawHTML, body);
        const reqNum = (body as Record<string, unknown>).requisitionNumber;

        // Call the PDF generator microservice backend from the server side
        const pdfResponse = await fetch('http://traefik:80/pdf/api/v1/generator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
          },
          body: JSON.stringify({
            html: hydratedHtml,
            documentId: crypto.randomUUID(),
            documentType: id,
            customPath: `transfers/${id}/${typeof reqNum === 'string' ? reqNum : 'draft'}`,
          }),
        });

        if (!pdfResponse.ok) {
          throw new Error(`PDF generator service responded with status ${pdfResponse.status}`);
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();

        return {
          status: 201 as const,
          body: {
            draftId: crypto.randomUUID(),
            pdfBase64: Buffer.from(pdfBuffer).toString('base64'),
            requisitionNumber: typeof reqNum === 'string' ? reqNum : '',
          },
        };
      } catch (err: unknown) {
        const cause = err instanceof Error ? (err as any).cause : undefined;
        logger.error(`Failed to create template draft PDF: ${err instanceof Error ? err.message : String(err)} | Cause: ${JSON.stringify(cause)}`, correlationId);
        return {
          status: 500 as const,
          body: {
            error: 'Internal server error creating template draft PDF.',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });
}