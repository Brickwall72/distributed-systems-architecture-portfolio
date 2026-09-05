// File: services/core/topology-service/src/topologyGateway.unit.test.ts
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
          senderOrgId: 'org-1111-lockheed',
          receiverOrgId: 'org-2222-ussf',
          assetId: 'asset-3333-gps3',
          actionContext: 'CUSTODY_TRANSFER'
        });

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('MISSING_CORRELATION_TOKEN');
    });

    it('should reject structurally invalid or malformed schema input targets with a 400 validation error', async () => {
      const response = await request(app)
        .post('/api/v1/topology/authorizations')
        .set('X-Correlation-ID', 'TRACING_TOKEN_ALPHA')
        .send({
          senderOrgId: 12345, // Violates explicit string contract mapping
          receiverOrgId: 'org-2222-ussf',
          assetId: 'asset-3333-gps3',
          actionContext: 'ILLEGAL_CONTEXT'
        });

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('SCHEMA_VALIDATION_FAILURE');
    });

    it('should authorize traffic and yield status AUTHORIZED when valid custody relationship exists', async () => {
      // Mock the record array wrapper parsing matrix
      const mockResultRecords = {
        records: [
          {
            get: vi.fn().mockReturnValue(1) // Mock authorizedCount return metric as 1 custody link
          }
        ]
      };

      mockSession.executeRead.mockImplementation(async (callback) => {
        const tx = { run: vi.fn().mockResolvedValue(mockResultRecords) };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/topology/authorizations')
        .set('X-Correlation-ID', 'TRACE-CUSTODY-77')
        .send({
          senderOrgId: 'org-1111-lockheed',
          receiverOrgId: 'org-2222-ussf',
          assetId: 'asset-3333-gps3',
          actionContext: 'CUSTODY_TRANSFER'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('AUTHORIZED');
      expect(response.body.correlationId).toBe('TRACE-CUSTODY-77');
    });

    it('should drop query outcomes to status DENIED when graph traversal counts yield zero custody records', async () => {
      const mockResultRecords = {
        records: [
          {
            get: vi.fn().mockReturnValue(0) // 0 valid relational custody links found
          }
        ]
      };

      mockSession.executeRead.mockImplementation(async (callback) => {
        const tx = { run: vi.fn().mockResolvedValue(mockResultRecords) };
        return callback(tx);
      });

      const response = await request(app)
        .post('/api/v1/topology/authorizations')
        .set('X-Correlation-ID', 'TRACE-CUSTODY-88')
        .send({
          senderOrgId: 'org-1111-lockheed',
          receiverOrgId: 'org-2222-ussf',
          assetId: 'asset-3333-gps3',
          actionContext: 'PROPERTY_HANDOVER'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('DENIED');
    });
  });

  describe('GET /api/v1/topology/entities', () => {
    it('should safely iterate across Cypher query outputs and return mapped transfer records', async () => {
      const mockRecordA = {
        get: (key: string) => {
          const data: Record<string, string> = {
            requisitionNumber: 'REQ-2026-SSC-0092',
            transferDate: '20260904',
            senderOrgId: 'org-1111-lockheed',
            senderName: 'Lockheed Martin Space',
            receiverOrgId: 'org-2222-ussf',
            receiverName: 'Space Systems Command (USSF)',
            assetId: 'asset-3333-gps3',
            assetNomenclature: 'GPS III Space Vehicle 11',
            serialNumber: 'GPS-III-SV11-001'
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
      expect(Array.isArray(response.body.transfers)).toBe(true);
      expect(response.body.transfers).toHaveLength(1);
      expect(response.body.transfers[0].requisitionNumber).toBe('REQ-2026-SSC-0092');
      expect(response.body.transfers[0].senderName).toBe('Lockheed Martin Space');
    });
  });
});