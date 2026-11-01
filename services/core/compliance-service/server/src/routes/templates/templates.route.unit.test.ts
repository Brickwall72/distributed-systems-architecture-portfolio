// File: services/core/compliance-service/server/src/routes/templates/templates.route.unit.test.ts
import express from 'express';
import supertest from 'supertest';
import { createExpressEndpoints } from '@ts-rest/express';
import { templatesContract, templateDTOSchema, templateManifestSchema, TemplateDraftResponseSchema } from 'compliance-shared';
import { mockFromSchema } from '@shared/testing';
import { PDF_SUBJECTS, generatePdfCommandSchema, generatePdfResponseSchema } from '@contracts/pdf';
import { zocker } from 'zocker';
import type { z } from 'zod';
import { createTemplatesRouter } from './templates.route';
import { TemplateRepository } from '../../repositories';

vi.mock('../../repositories', () => ({
  TemplateRepository: {
    findAllManifests: vi.fn(),
    findById: vi.fn(),
  },
}));

// zocker can't generate `.trim().min()` chains, so the name is supplied
const mockTemplateDto = (overrides: Partial<z.input<typeof templateDTOSchema>> = {}) =>
  mockFromSchema(templateDTOSchema, { name: 'Generated Template', ...overrides });

describe('Templates Router (ts-rest HTTP Contract Boundary)', () => {
  let app: express.Express;
  let mockBroker: { request: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());

    mockBroker = {
      request: vi.fn(),
    };

    const templatesRouter = createTemplatesRouter({ broker: mockBroker as any });
    createExpressEndpoints(templatesContract, templatesRouter, app);
  });

  describe('GET /templates (getTemplates)', () => {
    it('returns 200 with template manifest list on successful lookup', async () => {
      const mockManifests = [mockTemplateDto(), mockTemplateDto()].map(({ rawHTML: _rawHTML, ...manifest }) => templateManifestSchema.parse(manifest));

      vi.mocked(TemplateRepository.findAllManifests).mockReturnValue(mockManifests);

      const response = await supertest(app)
        .get('/templates')
        .set('x-correlation-id', 'test-corr-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockManifests);
      expect(TemplateRepository.findAllManifests).toHaveBeenCalledOnce();
    });

    it('returns 500 with RFC 7807 error schema when repository throws unexpected fault', async () => {
      vi.mocked(TemplateRepository.findAllManifests).mockImplementation(() => {
        throw new Error('Disk read failure');
      });

      const response = await supertest(app).get('/templates');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Internal server error retrieving template manifest.',
        code: 'INTERNAL_SERVER_ERROR',
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /templates/:id (getTemplate)', () => {
    it('returns 200 with full TemplateDTO when valid ID is provided', async () => {
      const mockTemplate = mockTemplateDto();

      vi.mocked(TemplateRepository.findById).mockReturnValue(mockTemplate);

      const response = await supertest(app)
        .get(`/templates/${mockTemplate.id}`)
        .set('x-correlation-id', 'test-corr-456');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTemplate);
      expect(TemplateRepository.findById).toHaveBeenCalledWith(mockTemplate.id);
    });

    it('returns 404 with error schema when template ID is not found', async () => {
      vi.mocked(TemplateRepository.findById).mockReturnValue(null);

      const response = await supertest(app).get('/templates/unknown-template-id');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: "Template [unknown-template-id] not found.",
        code: 'NOT_FOUND',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('returns 500 when repository throws an unhandled error during file fetch', async () => {
      vi.mocked(TemplateRepository.findById).mockImplementation(() => {
        throw new Error('Disk asset corruption');
      });

      const response = await supertest(app).get('/templates/asset-transfer-receipt');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: "Internal server error loading template [asset-transfer-receipt].",
        code: 'INTERNAL_SERVER_ERROR',
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /templates/:id/drafts (createTemplateDraft)', () => {
    // contract-test-bare has no registered payload pipeline, so the raw payload is hydrated as-is
    const template = () => mockTemplateDto({ id: 'contract-test-bare', rawHTML: '<h1>{{requisitionNumber}}</h1>' });

    it('sends a globally-contracted PDF command and returns a contract-valid draft response', async () => {
      const mockTemplate = template();
      vi.mocked(TemplateRepository.findById).mockReturnValue(mockTemplate);
      const pdfResponse = zocker(generatePdfResponseSchema)
        .supply(generatePdfResponseSchema.shape.success, true)
        .generate();
      mockBroker.request.mockResolvedValue(pdfResponse);

      const response = await supertest(app)
        .post(`/templates/${mockTemplate.id}/drafts`)
        .send({ data: { input: { targetOrg: { id: 'org-123' } } } })
        .set('x-correlation-id', 'test-corr-789');

      expect(response.status).toBe(201);
      const draft = TemplateDraftResponseSchema.parse(response.body);
      expect(draft.presignedUrl).toBe(pdfResponse.presignedUrl);
      expect(draft.storageKey).toBe(pdfResponse.storageKey);

      const [subject, payload, options] = mockBroker.request.mock.calls[0];
      expect(subject).toBe(PDF_SUBJECTS.GENERATE_PDF);
      expect(generatePdfCommandSchema.parse(payload)).toEqual(payload);
      expect(payload.html).toContain(draft.requisitionNumber);
      expect(options).toMatchObject({ correlationId: 'test-corr-789' });
    });

    it('preserves a supplied non-empty requisitionNumber and generates one when missing or blank', async () => {
      const mockTemplate = template();
      vi.mocked(TemplateRepository.findById).mockReturnValue(mockTemplate);
      mockBroker.request.mockResolvedValue(
        zocker(generatePdfResponseSchema).supply(generatePdfResponseSchema.shape.success, true).generate()
      );

      const kept = await supertest(app)
        .post(`/templates/${mockTemplate.id}/drafts`)
        .send({ data: { requisitionNumber: 'REQ-EXISTING-1' } });
      expect(kept.status).toBe(201);
      expect(kept.body.requisitionNumber).toBe('REQ-EXISTING-1');
      expect(mockBroker.request.mock.calls.at(-1)![1].html).toContain('REQ-EXISTING-1');

      const blank = await supertest(app)
        .post(`/templates/${mockTemplate.id}/drafts`)
        .send({ data: { requisitionNumber: '  ' } });
      expect(blank.body.requisitionNumber).toMatch(/^REQ-\d{4}-[0-9A-F]{8}$/);
    });

    it('returns 404 when template ID is not found during draft creation', async () => {
      vi.mocked(TemplateRepository.findById).mockReturnValue(null);

      const response = await supertest(app)
        .post(`/templates/${mockTemplateDto().id}/drafts`)
        .send({ data: {} });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns 500 when NATS broker request throws an error', async () => {
      const mockTemplate = template();
      vi.mocked(TemplateRepository.findById).mockReturnValue(mockTemplate);
      mockBroker.request.mockRejectedValue(new Error('NATS request timeout'));

      const response = await supertest(app).post(`/templates/${mockTemplate.id}/drafts`).send({ data: {} });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({ error: 'NATS request timeout', code: 'INTERNAL_SERVER_ERROR' });
    });

    it('returns 500 when the PDF service replies with a payload violating the shared contract', async () => {
      const mockTemplate = template();
      vi.mocked(TemplateRepository.findById).mockReturnValue(mockTemplate);
      mockBroker.request.mockResolvedValue({ success: true });

      const response = await supertest(app).post(`/templates/${mockTemplate.id}/drafts`).send({ data: {} });

      expect(response.status).toBe(500);
    });
  });
});
