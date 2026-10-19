// File: services/core/compliance-service/server/src/routes/documents/documents.route.unit.test.ts
import { createDocumentsRouter } from './documents.route';
import { EventBroker } from '@shared/messaging';
import { ESIGN_COMMAND_SUBJECTS } from '@contracts/esign';

// Mock database pool and logger dependencies
vi.mock('../../db', () => ({
  pool: {},
}));

vi.mock('@shared/express', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockFindAll = vi.fn();
const mockFindById = vi.fn();

vi.mock('../../repositories', () => ({
  ComplianceDocumentRepository: class {
    async findAll() {
      return mockFindAll();
    }
    async findById(id: string) {
      return mockFindById(id);
    }
  },
}));

describe('Documents Router Unit Tests', () => {
  let router: ReturnType<typeof createDocumentsRouter>;
  let mockBroker: EventBroker;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBroker = {
      request: vi.fn(),
    } as unknown as EventBroker;
    router = createDocumentsRouter({ broker: mockBroker });
  });

  describe('GET /documents', () => {
    it('returns 200 with list of documents when repository succeeds', async () => {
      const mockDocs = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          documentType: 'asset-transfer-authorization',
          storageBucket: 'compliance-vault',
          storageKey: '2026/dd1149.pdf',
          status: 'SIGNED',
          createdAt: '2026-09-15T14:32:00.000Z',
          updatedAt: '2026-09-15T14:32:00.000Z',
        },
      ];
      mockFindAll.mockResolvedValueOnce(mockDocs);

      const result = await router.getDocuments({
        query: {},
        params: {},
        req: {
          headers: { 'x-correlation-id': 'test-corr-1' },
        },
      } as any);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(mockDocs);
      expect(mockFindAll).toHaveBeenCalledOnce();
    });

    it('returns 500 with structured error payload when repository throws', async () => {
      mockFindAll.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await router.getDocuments({
        query: {},
        params: {},
        req: {
          headers: {},
        },
      } as any);

      expect(result.status).toBe(500);
      expect(result.body).toEqual(
        expect.objectContaining({
          error: 'Database connection failed',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('GET /documents/:id', () => {
    it('returns 200 with document DTO when found by ID', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174000';
      const mockDoc = {
        id: docId,
        documentType: 'asset-transfer-authorization',
        storageBucket: 'compliance-vault',
        storageKey: '2026/dd1149.pdf',
        status: 'SIGNED',
        createdAt: '2026-09-15T14:32:00.000Z',
        updatedAt: '2026-09-15T14:32:00.000Z',
      };
      mockFindById.mockResolvedValueOnce(mockDoc);

      const result = await router.getDocumentById({
        params: { id: docId },
        query: {},
        req: {
          headers: {},
        },
      } as any);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(mockDoc);
      expect(mockFindById).toHaveBeenCalledWith(docId);
    });

    it('returns 404 when document is not found in repository', async () => {
      const missingId = '999e4567-e89b-12d3-a456-426614174999';
      mockFindById.mockResolvedValueOnce(null);

      const result = await router.getDocumentById({
        params: { id: missingId },
        query: {},
        req: {
          headers: {},
        },
      } as any);

      expect(result.status).toBe(404);
      expect(result.body).toEqual(
        expect.objectContaining({
          error: `Document with ID '${missingId}' was not found.`,
          code: 'NOT_FOUND',
          timestamp: expect.any(String),
        })
      );
    });

    it('returns 500 when repository lookup throws an unexpected error', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174000';
      mockFindById.mockRejectedValueOnce(new Error('Query timeout'));

      const result = await router.getDocumentById({
        params: { id: docId },
        query: {},
        req: {
          headers: {},
        },
      } as any);

      expect(result.status).toBe(500);
      expect(result.body).toEqual(
        expect.objectContaining({
          error: 'Query timeout',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('POST /documents/sign', () => {
    it('returns 200 with signed document and presignedUrl on successful broker request', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174000';
      const validHash = 'a'.repeat(64);

      const mockSignResponse = {
        success: true,
        id: docId,
        createdAt: '2026-10-18T21:00:00.000Z',
        updatedAt: '2026-10-18T21:00:00.000Z',
        storageBucket: 'dsap',
        storageKey: `${docId}.pdf`,
        s3Uri: `s3://dsap/${docId}.pdf`,
        presignedUrl: 'http://localhost:9000/dsap/test.pdf?signature=123',
        fileHash: validHash,
        signedAt: '2026-10-18T21:00:00.000Z',
        uploadedAt: '2026-10-18T21:00:00.000Z',
        correlationId: 'test-corr-2',
      };

      vi.mocked(mockBroker.request).mockResolvedValueOnce(mockSignResponse);
      mockFindById.mockResolvedValueOnce(null);

      const result = await router.signDocument({
        body: {
          storageBucket: 'dsap',
          storageKey: 'source.pdf',
          fileHash: validHash,
          signatureImageBase64: 'base64sig',
          documentId: docId,
          documentType: 'asset-transfer-authorization',
          signerId: 'usr_1',
          entityId: 'org_1',
        },
        query: {},
        params: {},
        req: {
          headers: { 'x-correlation-id': 'test-corr-2' },
        },
      } as any);

      expect(result.status).toBe(200);
      expect(mockBroker.request).toHaveBeenCalledWith(
        ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT,
        expect.objectContaining({ documentId: docId, correlationId: 'test-corr-2' }),
        { timeout: 10000, correlationId: 'test-corr-2' }
      );
      expect(result.body).toMatchObject({
        id: docId,
        storageBucket: 'dsap',
        presignedUrl: 'http://localhost:9000/dsap/test.pdf?signature=123',
      });
    });

    it('returns 500 when broker request throws or fails', async () => {
      vi.mocked(mockBroker.request).mockRejectedValueOnce(new Error('NATS timeout'));

      const result = await router.signDocument({
        body: {
          storageBucket: 'dsap',
          storageKey: 'source.pdf',
          fileHash: 'a'.repeat(64),
          signatureImageBase64: 'base64sig',
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          documentType: 'asset-transfer-authorization',
          signerId: 'usr_1',
          entityId: 'org_1',
        },
        query: {},
        params: {},
        req: {
          headers: {},
        },
      } as any);

      expect(result.status).toBe(500);
      expect(result.body).toEqual(
        expect.objectContaining({
          error: 'NATS timeout',
          code: 'SIGNATURE_PROCESSING_FAILED',
          timestamp: expect.any(String),
        })
      );
    });
  });
});