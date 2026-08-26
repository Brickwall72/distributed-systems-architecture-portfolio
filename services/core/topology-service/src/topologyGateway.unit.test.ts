// File: services/core/topology-service/src/topologyGateway.unit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { topologyGateway } from './topologyGateway.js';
import { getDatabaseClient } from './topologyDatabase.js';

// Setup mock framework targets for the local database connection singleton module
vi.mock('./topologyDatabase.js', () => ({
  getDatabaseClient: vi.fn()
}));

describe('Unit/Integration Test Matrix: Topology Routing Engine (topologyGateway)', () => {
  let app: express.Application;
  
  // Mock session control parameters mimicking the native Neo4j driver interface hooks
  const mockSession = {
    executeRead: vi.fn(),
    close: vi.fn(() => Promise.resolve())
  };

  const mockDriver = {
    session: vi.fn(() => mockSession)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getDatabaseClient as any).mockReturnValue(mockDriver);

    // Bootstrap an isolated express network wrapper container for test evaluation passes
    app = express();
    app.use(express.json());
    app.use('/api/v1/topology', topologyGateway);
  });

  describe('POST /api/v1/topology/authorizations', () => {
    it('should drop down into a 400 Bad Request if the mandatory X-Correlation-ID header is omitted', async () => {
      const response = await request(app)
        .post('/api/v1/topology/authorizations')
        .send({
          sourceAssetId: 'a3b48270-1283-4a11-bca9-593ef2718902',
          targetAssetId: 'f3b48270-1283-4a11-bca9-593ef2718902',
          actionContext: 'SQUADRON_HANDOVER'
        });

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('MISSING_CORRELATION_TOKEN');
    });

    it('should reject structurally invalid or malformed schema input targets with a 400 validation error', async () => {
      const response = await request(app)
        .post('/api/v1/topology/authorizations')
        .set('X-Correlation-ID', 'TRACING_TOKEN_ALPHA')
        .send({
          sourceAssetId: 12345, // Violates explicit string contract mapping
          targetAssetId: 'f3b48270-1283-4a11-bca9-593ef2718902',
          actionContext: 'ILLEGAL_CONTEXT'
        });

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('SCHEMA_VALIDATION_FAILURE');
    });

    it('should authorize traffic and yield status AUTHORIZED when a valid database match line exists', async () => {
      // Mock the record array wrapper parsing matrix
      const mockResultRecords = {
        records: [
          {
            get: vi.fn().mockReturnValue(1) // Mock authorizedCount return metric as 1 path link
          }
        ]
      };

      mockSession.executeRead.mockImplementation(async (callback) => {
        const tx = { run: vi.fn().mockResolvedValue(mockResultRecords) };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/topology/authorizations')
        .set('X-Correlation-ID', 'TRACE-AIRCRAFT-77')
        .send({
          sourceAssetId: 'a3b48270-1283-4a11-bca9-593ef2718902',
          targetAssetId: 'f3b48270-1283-4a11-bca9-593ef2718902',
          actionContext: 'SQUADRON_HANDOVER'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('AUTHORIZED');
      expect(response.body.correlationId).toBe('TRACE-AIRCRAFT-77');
    });

    it('should drop query outcomes to status DENIED when graph traversal counts yield zero links', async () => {
      const mockResultRecords = {
        records: [
          {
            get: vi.fn().mockReturnValue(0) // 0 valid relational links found inside database rows
          }
        ]
      };

      mockSession.executeRead.mockImplementation(async (callback) => {
        const tx = { run: vi.fn().mockResolvedValue(mockResultRecords) };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/topology/authorizations')
        .set('X-Correlation-ID', 'TRACE-AIRCRAFT-88')
        .send({
          sourceAssetId: 'a3b48270-1283-4a11-bca9-593ef2718902',
          targetAssetId: 'f3b48270-1283-4a11-bca9-593ef2718902',
          actionContext: 'CARGO_TRANSFER'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('DENIED');
    });
  });

  describe('GET /api/v1/topology/entities', () => {
    it('should safely iterate across Cypher query outputs and return mapped connection arrays', async () => {
      const mockRecordA = {
        get: (key: string) => {
          const data: Record<string, string> = {
            sourceAssetId: 'src-1',
            sourceLabel: 'Eagle 1',
            targetAssetId: 'tgt-1',
            targetLabel: 'Base 1',
            actionContext: 'SQUADRON_HANDOVER'
          };
          return data[key];
        }
      };

      const mockResultRecords = { records: [mockRecordA] };

      mockSession.executeRead.mockImplementation(async (callback) => {
        const tx = { run: vi.fn().mockResolvedValue(mockResultRecords) };
        return callback(tx);
      });

      const response = await request(app)
        .get('/api/v1/topology/entities')
        .set('X-Correlation-ID', 'TRACE-ENTITIES-99');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.connections)).toBe(true);
      expect(response.body.connections).toHaveLength(1);
      expect(response.body.connections[0].sourceLabel).toBe('Eagle 1');
    });
  });
});
