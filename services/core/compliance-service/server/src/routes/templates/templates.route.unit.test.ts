// File: services/core/compliance-service/server/src/routes/templates/templates.route.unit.test.ts
import express from 'express';
import supertest from 'supertest';
import { createExpressEndpoints } from '@ts-rest/express';
import { templatesContract, TemplateManifest, TemplateDTO } from 'compliance-shared';
import { createTemplatesRouter } from './templates.route';
import { TemplateRepository } from '../../repositories';

vi.mock('../../repositories', () => ({
  TemplateRepository: {
    findAllManifests: vi.fn(),
    findById: vi.fn(),
  },
}));

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
      const mockManifests: TemplateManifest[] = [
        {
          id: 'asset-transfer-authorization',
          name: 'Asset Transfer Authorization',
          type: 'AUTHORIZATION',
        },
        {
          id: 'asset-transfer-receipt',
          name: 'Asset Transfer Receipt',
          type: 'RECEIPT',
        },
      ];

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
      const mockTemplate: TemplateDTO = {
        id: 'asset-transfer-authorization',
        name: 'Asset Transfer Authorization',
        type: 'AUTHORIZATION',
        rawHTML: '<h1>Authorization Template</h1>',
      };

      vi.mocked(TemplateRepository.findById).mockReturnValue(mockTemplate);

      const response = await supertest(app)
        .get('/templates/asset-transfer-authorization')
        .set('x-correlation-id', 'test-corr-456');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTemplate);
      expect(TemplateRepository.findById).toHaveBeenCalledWith('asset-transfer-authorization');
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
    it('returns 201 with draftId and presignedUrl on successful NATS PDF generation', async () => {
      const mockTemplate: TemplateDTO = {
        id: 'asset-transfer-authorization',
        name: 'Asset Transfer Authorization',
        type: 'AUTHORIZATION',
        rawHTML: '<h1>{{input.requisitionNumber}}</h1>',
      };

      vi.mocked(TemplateRepository.findById).mockReturnValue(mockTemplate);

      const mockPdfResponse = {
        success: true,
        documentId: '3ef7a5e5-72d3-47df-a5d6-f3e871e34df9',
        s3Uri: 's3://drafts/org-123/transfers/asset-transfer-authorization/REQ-2026-0001.pdf',
        storageBucket: 'drafts',
        storageKey: 'org-123/transfers/asset-transfer-authorization/REQ-2026-0001.pdf',
        presignedUrl: 'http://localhost:9000/drafts/test-document.pdf?signature=xyz',
        fileHash: 'sha256fakehash',
        correlationId: 'test-corr-789',
      };

      mockBroker.request.mockResolvedValue(mockPdfResponse);

      const response = await supertest(app)
        .post('/templates/asset-transfer-authorization/drafts')
        .send({
          requisitionNumber: 'REQ-2026-0001',
          input: { targetOrg: { id: 'org-123' } },
        })
        .set('x-correlation-id', 'test-corr-789');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        draftId: '3ef7a5e5-72d3-47df-a5d6-f3e871e34df9',
        presignedUrl: 'http://localhost:9000/drafts/test-document.pdf?signature=xyz',
        requisitionNumber: 'REQ-2026-0001',
      });

      expect(mockBroker.request).toHaveBeenCalledWith(
        'pdf.command.generate-draft',
        expect.objectContaining({
          documentType: 'asset-transfer-authorization',
          entityId: 'org-123',
        }),
        expect.objectContaining({ correlationId: 'test-corr-789' })
      );
    });

    it('returns 404 when template ID is not found during draft creation', async () => {
      vi.mocked(TemplateRepository.findById).mockReturnValue(null);

      const response = await supertest(app)
        .post('/templates/asset-transfer-authorization/drafts')
        .send({
          requisitionNumber: 'REQ-2026-0001',
          input: { targetOrg: { id: 'org-123' } },
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Template [asset-transfer-authorization] not found.',
        code: 'NOT_FOUND',
      });
    });

    it('returns 500 when NATS broker request throws an error', async () => {
      const mockTemplate: TemplateDTO = {
        id: 'asset-transfer-authorization',
        name: 'Asset Transfer Authorization',
        type: 'AUTHORIZATION',
        rawHTML: '<h1>Test</h1>',
      };

      vi.mocked(TemplateRepository.findById).mockReturnValue(mockTemplate);
      mockBroker.request.mockRejectedValue(new Error('NATS request timeout'));

      const response = await supertest(app)
        .post('/templates/asset-transfer-authorization/drafts')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'NATS request timeout', // Matches the dynamic error message thrown by the mock
        code: 'INTERNAL_SERVER_ERROR',
      });
    });
  });
});