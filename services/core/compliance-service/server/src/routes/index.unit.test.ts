import express from 'express';
import supertest from 'supertest';
import type { Pool } from 'pg';
import { EventBroker } from '@shared/messaging';
import { CompliancePublisher } from '../messaging';
import { DocumentsRepository, TemplateRepository } from '../repositories';
import { createComplianceGateway } from './index';

describe('createComplianceGateway', () => {
  let app: express.Express;
  let findAllManifests: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    findAllManifests = vi.spyOn(TemplateRepository, 'findAllManifests').mockReturnValue([]);
    vi.spyOn(TemplateRepository, 'findById').mockReturnValue(null);

    app = express();
    app.use(express.json());

    const broker = new EventBroker('nats://localhost:4222');
    const publisher = new CompliancePublisher(broker);
    const repository = new DocumentsRepository({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool);

    app.use('/api/v1', createComplianceGateway({ broker, publisher, repository }));
  });

  it('mounts the health check endpoint', async () => {
    const response = await supertest(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'HEALTHY',
      service: 'compliance-server',
      timestamp: expect.any(String),
    });
  });

  it('binds the template endpoint to the gateway', async () => {
    const response = await supertest(app).get('/api/v1/templates');

    expect(response.status).toBe(200);
    expect(findAllManifests).toHaveBeenCalledOnce();
  });

  it('binds the documents endpoint to the injected repository', async () => {
    const response = await supertest(app).get('/api/v1/documents');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
