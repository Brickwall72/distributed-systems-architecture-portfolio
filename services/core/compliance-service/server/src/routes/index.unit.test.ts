// File: services/core/compliance-service/server/src/routes/index.unit.test.ts
import express from 'express';
import supertest from 'supertest';
import type { Pool } from 'pg';
import { EventBroker } from '@shared/messaging';
import { DocumentsRepository, TemplateRepository, SigningOperationsRepository } from '../repositories';
import { createComplianceGateway } from './index';
import { TopologyNatsClient } from '../messaging';

describe('createComplianceGateway', () => {
  let app: express.Express;
  let findAllManifests: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    findAllManifests = vi.spyOn(TemplateRepository, 'findAllManifests').mockReturnValue([]);
    vi.spyOn(TemplateRepository, 'findById').mockReturnValue(null);

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.identity = { sub: 'member', signerId: 'member', orgId: 'org-a', roles: ['org-member'] };
      next();
    });

    const broker = new EventBroker('nats://localhost:4222');
    const repository = new DocumentsRepository({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool);

    const topology = new TopologyNatsClient(broker);
    const signingOperations = new SigningOperationsRepository({} as Pool);
    const signingCoordinator = { processNext: vi.fn() };
    app.use('/api/v1', createComplianceGateway({ broker, repository, topology, signingOperations, signingCoordinator, getSignedDownloadUrl: vi.fn() }));
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

  it('accepts structural dependencies without requiring concrete class instances', async () => {
    const repository = {
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findTransferParticipants: vi.fn(),
      findDraftBinding: vi.fn(),
      saveDraftBinding: vi.fn(),
    };
    const router = createComplianceGateway({
      broker: { request: vi.fn() },
      repository,
      topology: { validateDraft: vi.fn() },
      signingOperations: { enqueue: vi.fn(), find: vi.fn() },
      signingCoordinator: { processNext: vi.fn() },
      getSignedDownloadUrl: vi.fn(),
    });
    const app = express();
    app.use((req, _res, next) => {
      req.identity = { sub: 'member', signerId: 'member', orgId: 'org-a', roles: ['org-member'] };
      next();
    });
    app.use('/api/v1', router);
    expect((await supertest(app).get('/api/v1/documents')).status).toBe(200);
    expect(repository.findAll).toHaveBeenCalledOnce();
  });
});
