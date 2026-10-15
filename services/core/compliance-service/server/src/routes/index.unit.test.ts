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

// Mock sub-routers that execute database calls on mount/request
vi.mock('./documents', () => {
  const router = express.Router();
  router.get('/', (_req, res) => {
    res.status(200).json({ mock: 'documents-route-hit' });
  });
  return { default: router };
});

describe('createComplianceGateway (Route Accumulator Topology)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    const mockBroker = { request: vi.fn() };

    // ✅ Pass mock broker explicitly into createComplianceGateway
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
    expect(response.body).toEqual({ mock: 'documents-route-hit' });
  });
});