// File: services/core/compliance-service/server/src/routes/index.unit.test.ts
import express from 'express';
import supertest from 'supertest';
import { createComplianceGateway } from './index';
import { TemplateRepository } from '../repositories';

// Mock underlying repositories to prevent real disk I/O or DB execution during topology verification
vi.mock('../repositories', () => ({
  TemplateRepository: {
    findAllManifests: vi.fn().mockReturnValue([]),
    findById: vi.fn().mockReturnValue(null),
  },
}));

// Mock documents router with valid ts-rest route implementations
vi.mock('./documents', () => ({
  createDocumentsRouter: () => ({
    getDocuments: async () => ({
      status: 200 as const,
      body: [{ mock: 'documents-route-hit' }],
    }),
    getDocumentById: async () => ({
      status: 200 as const,
      body: { mock: 'document-hit' },
    }),
  }),
}));

describe('createComplianceGateway (Route Accumulator Topology)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    const mockBroker = { request: vi.fn() };

    app.use('/api/v1', createComplianceGateway({ broker: mockBroker as any }));
  });

  it('mounts the /health check endpoint with service health payload', async () => {
    const response = await supertest(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'HEALTHY',
      service: 'compliance-server',
      timestamp: expect.any(String),
    });
  });

  it('binds ts-rest complianceContract template endpoints to the gateway', async () => {
    const response = await supertest(app).get('/api/v1/templates');

    expect(response.status).toBe(200);
    expect(TemplateRepository.findAllManifests).toHaveBeenCalledOnce();
  });

  it('correctly mounts sub-routers under expected path prefixes', async () => {
    const response = await supertest(app).get('/api/v1/documents');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ mock: 'documents-route-hit' }]);
  });
});