// File: services/core/topology-service/server/src/routes/graph/graph.unit.test.ts
import express from 'express';
import request from 'supertest';
import { createExpressEndpoints } from '@ts-rest/express';
import { graphRoutes } from 'topology-shared';
import { createGraphRouter } from './graph.route';
import type { GraphRepository } from '../../repositories';

describe('Graph Router (/graph)', () => {
  let app: express.Express;
  let mockGraphRepository: { getGraph: any };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGraphRepository = {
      getGraph: vi.fn(),
    };

    const router = express.Router();
    router.use(express.json());

    const graphRouter = createGraphRouter(mockGraphRepository as unknown as GraphRepository);
    createExpressEndpoints(graphRoutes, graphRouter, router);

    app = express();
    app.use(express.json());
    app.use('/api/v1', router);
  });

  it('should return 200 OK and valid graph DTO on successful graph extraction', async () => {
    const mockGraph = {
      timestamp: new Date().toISOString(),
      organizations: [{ id: 'org-1', name: 'Alpha Command', type: 'CONTRACTOR' }],
      assets: [{ id: 'asset-1', name: 'Probe', nomenclature: 'Probe', serialNumber: '01', status: 'AVAILABLE' }],
      activeTransfers: [],
      custodyLinks: [{ orgId: 'org-1', assetId: 'asset-1' }],
    };

    mockGraphRepository.getGraph.mockResolvedValue(mockGraph);

    const response = await request(app).get('/api/v1/graph');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockGraph);
    expect(mockGraphRepository.getGraph).toHaveBeenCalledTimes(1);
  });

  it('should return 500 Internal Server Error when repository throws an exception', async () => {
    mockGraphRepository.getGraph.mockRejectedValue(new Error('Neo4j connection drop'));

    const response = await request(app).get('/api/v1/graph');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'The topology graph engine could not cleanly enumerate network nodes.',
      code: 'TOPOLOGY_ENTITY_QUERY_FAILURE',
      timestamp: expect.any(String),
    });
  });
});