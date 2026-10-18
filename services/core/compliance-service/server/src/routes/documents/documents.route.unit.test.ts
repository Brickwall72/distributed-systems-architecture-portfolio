// File: services/core/compliance-service/server/src/routes/documents/documents.route.unit.test.ts
import { createDocumentsRouter } from './documents.route';

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

  beforeEach(() => {
    vi.clearAllMocks();
    router = createDocumentsRouter();
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
});