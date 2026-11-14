// File: services/core/compliance-service/server/src/routes/documents/documents.route.unit.test.ts
import { createDocumentsRouter } from './documents.route';
import { DocumentsRepository, draftBindingSchema, SigningOperationsRepository, SigningRequestConflict } from '../../repositories';
import { documentEntitySchema } from '../../domain';
import { DocumentSchema, signDocumentApiRequestSchema } from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';

vi.mock('../../db', () => ({ pool: {} }));

vi.mock('@shared/express', async (importOriginal) => ({
  ...await importOriginal<typeof import('@shared/express')>(),
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockInsert = vi.fn();
const mockFindTransferParticipants = vi.fn();
const mockFindDraftBinding = vi.fn();
let activeBinding: unknown;

vi.mock('../../repositories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../repositories')>();
  return {
    ...actual,
    DocumentsRepository: class {
      findAll = (...args: unknown[]) => mockFindAll(...args);
      findById = (...args: unknown[]) => mockFindById(...args);
      findTransferParticipants = (...args: unknown[]) => mockFindTransferParticipants(...args);
      findDraftBinding = (...args: unknown[]) => mockFindDraftBinding(...args);
      insert = (data: unknown) => mockInsert(data);
    },
  };
});

const mockEntity = (overrides: Partial<Parameters<typeof documentEntitySchema.parse>[0]> = {}) =>
  mockFromSchema(documentEntitySchema, { fileHash: SHA256_HEX, ...overrides });

const request = (headers: Record<string, string> = {}, extra: object = {}) =>
  ({ query: {}, params: {}, req: { headers, identity: { sub: 'usr_1', signerId: 'usr_1', orgId: 'org-a', roles: ['org-member'] } }, ...extra }) as never;

describe('Documents Router Unit Tests', () => {
  let router: ReturnType<typeof createDocumentsRouter>;
  let repository: DocumentsRepository;
  const getSignedDownloadUrl = vi.fn();
  let operations: SigningOperationsRepository;
  let coordinator: { processNext: ReturnType<typeof vi.fn<(documentId?: string) => Promise<boolean>>> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindDraftBinding.mockImplementation(async () => activeBinding);
    repository = new DocumentsRepository({} as never);
    operations = new SigningOperationsRepository({} as never);
    operations.enqueue = vi.fn().mockResolvedValue({});
    operations.find = vi.fn().mockResolvedValue({ state: 'COMPLETED' });
    coordinator = { processNext: vi.fn().mockResolvedValue(true) };
    router = createDocumentsRouter({
      repository,
      signingOperations: operations,
      signingCoordinator: coordinator,
      getSignedDownloadUrl,
    });
  });

  describe('GET /documents', () => {
    it('rejects missing identities and missing organization scopes', async () => {
      const missing = await router.getDocuments(request({}, { req: { headers: {} } }));
      const noOrg = await router.getDocuments(request({}, {
        req: { headers: {}, identity: { sub: 'usr_1', signerId: 'usr_1', orgId: null, roles: ['org-member'] } },
      }));
      expect(missing.status).toBe(401);
      expect(noOrg.status).toBe(403);
      expect(mockFindAll).not.toHaveBeenCalled();
    });

    it('allows auditors to use unrestricted read scope', async () => {
      mockFindAll.mockResolvedValueOnce([]);
      const result = await router.getDocuments(request({}, {
        req: { headers: {}, identity: { sub: 'auditor', signerId: 'auditor', orgId: null, roles: ['auditor'] } },
      }));
      expect(result.status).toBe(200);
      expect(mockFindAll).toHaveBeenCalledWith(expect.anything(), { kind: 'auditor' });
    });

    it('returns 200 with API-contract documents when repository succeeds', async () => {
      const docs = [mockEntity(), mockEntity()];
      mockFindAll.mockResolvedValueOnce(docs);

      const result = await router.getDocuments(request({ 'x-correlation-id': 'test-corr-1' }));

      expect(result.status).toBe(200);
      expect(result.body).toEqual(docs.map((doc) => DocumentSchema.parse(doc)));
      expect(mockFindAll).toHaveBeenCalledWith(expect.anything(), { kind: 'organization', orgId: 'org-a' });
    });

    it('returns 500 with structured error payload when repository throws', async () => {
      mockFindAll.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await router.getDocuments(request());

      expect(result.status).toBe(500);
      expect(result.body).toEqual(
        expect.objectContaining({ error: 'Database connection failed', code: 'INTERNAL_SERVER_ERROR', timestamp: expect.any(String) }),
      );
    });
  });

  describe('GET /documents/:id', () => {
    it('returns 200 with the document DTO when found by ID', async () => {
      const doc = mockEntity();
      mockFindById.mockResolvedValueOnce(doc);

      const result = await router.getDocumentById(request({}, { params: { id: doc.id } }));

      expect(result.status).toBe(200);
      expect(result.body).toEqual(DocumentSchema.parse(doc));
      expect(mockFindById).toHaveBeenCalledWith(doc.id, { kind: 'organization', orgId: 'org-a' });
    });

    describe('GET /documents/:id/content', () => {
      it('signs the stored bucket and key and prevents caching the response', async () => {
        const doc = mockEntity();
        const setHeader = vi.fn();
        mockFindById.mockResolvedValueOnce(doc);
        getSignedDownloadUrl.mockResolvedValueOnce('https://storage.example/dsap/file.pdf?signature=test');

        const result = await router.getDocumentContentById(request({}, {
          params: { id: doc.id },
          req: { headers: {}, res: { setHeader }, identity: { sub: 'usr_1', signerId: 'usr_1', orgId: 'org-a', roles: ['org-member'] } },
        }));

        expect(result).toEqual({ status: 200, body: { presignedUrl: 'https://storage.example/dsap/file.pdf?signature=test' } });
        expect(getSignedDownloadUrl).toHaveBeenCalledWith({
          storageBucket: doc.storageBucket, storageKey: doc.storageKey, expiresInSeconds: 600,
        });
        expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      });

      it('returns 404 without signing a missing document', async () => {
        mockFindById.mockResolvedValueOnce(null);
        const result = await router.getDocumentContentById(request({}, { params: { id: mockEntity().id } }));
        expect(result.status).toBe(404);
        expect(getSignedDownloadUrl).not.toHaveBeenCalled();
      });

      it('does not expose presigner errors', async () => {
        mockFindById.mockResolvedValueOnce(mockEntity());
        getSignedDownloadUrl.mockRejectedValueOnce(new Error('internal storage details'));
        const result = await router.getDocumentContentById(request({}, { params: { id: mockEntity().id } }));
        expect(result.status).toBe(500);
        expect(result.body).toMatchObject({ error: 'Internal server error retrieving document content.' });
      });
    });

    it('returns 404 when document is not found in repository', async () => {
      const missingId = mockEntity().id;
      mockFindById.mockResolvedValueOnce(null);

      const result = await router.getDocumentById(request({}, { params: { id: missingId } }));

      expect(result.status).toBe(404);
      expect(result.body).toEqual(
        expect.objectContaining({ error: `Document with ID '${missingId}' was not found.`, code: 'NOT_FOUND' }),
      );
    });

    it('returns 500 when repository lookup throws an unexpected error', async () => {
      mockFindById.mockRejectedValueOnce(new Error('Query timeout'));

      const result = await router.getDocumentById(request({}, { params: { id: mockEntity().id } }));

      expect(result.status).toBe(500);
      expect(result.body).toEqual(expect.objectContaining({ error: 'Query timeout', code: 'INTERNAL_SERVER_ERROR' }));
    });
  });

  describe('POST /documents/sign', () => {
    const signBody = (overrides = {}) => {
      const body = mockFromSchema(signDocumentApiRequestSchema, {
        signerId: 'usr_1',
        documentName: 'asset-transfer-authorization',
        documentType: 'AUTHORIZATION',
        transferType: 'PHYSICAL_TRANSFER',
        transferEventId: undefined,
        assetIds: ['asset-1'],
        requisitionNumber: 'REQ-1',
        storageBucket: 'dsap',
        fileHash: SHA256_HEX,
        senderOrgId: 'org-a',
        receiverOrgId: 'org-b',
        ...overrides,
      });
      activeBinding = draftBindingSchema.parse(body);
      return body;
    };

    it('requires an authenticated organization member before requesting a signature', async () => {
      const body = signBody();
      const missing = await router.signDocument(request({}, { body, req: { headers: {} } }));
      const auditor = await router.signDocument(request({}, {
        body,
        req: { headers: {}, identity: { sub: 'auditor', signerId: 'auditor', orgId: null, roles: ['auditor'] } },
      }));
      expect(missing.status).toBe(401);
      expect(auditor.status).toBe(403);
      expect(coordinator.processNext).not.toHaveBeenCalled();
    });

    it('does not allow a member to sign an authorization for a different sender', async () => {
      const result = await router.signDocument(request({}, { body: signBody({ senderOrgId: 'other-org' }) }));
      expect(result.status).toBe(403);
      expect(coordinator.processNext).not.toHaveBeenCalled();
    });

    it('rejects storage, participant, asset and template substitution before signing', async () => {
      const body = signBody();
      for (const changes of [
        { storageKey: `${body.storageKey}-other` },
        { receiverOrgId: 'other-org' },
        { assetIds: [...body.assetIds, 'other-asset'] },
        { documentName: 'authority-transfer-authorization' },
      ]) {
        const result = await router.signDocument(request({}, { body: { ...body, ...changes } }));
        expect(result.status).toBe(409);
      }
      expect(coordinator.processNext).not.toHaveBeenCalled();
    });

    it('does not sign a draft belonging to another identity', async () => {
      const body = signBody();
      mockFindDraftBinding.mockResolvedValueOnce(null);
      const result = await router.signDocument(request({}, { body }));
      expect(result.status).toBe(409);
      expect(mockFindDraftBinding).toHaveBeenCalledWith(body.documentId, 'usr_1', 'org-a');
      expect(coordinator.processNext).not.toHaveBeenCalled();
    });

    it('enqueues a draft-bound claim and returns a fresh authorized URL after completion', async () => {
      const body = signBody();
      mockFindById.mockResolvedValueOnce(mockEntity({ type: 'AUTHORIZATION' }));
      getSignedDownloadUrl.mockResolvedValueOnce('http://localhost:9000/signed');

      const result = await router.signDocument(request({ 'x-correlation-id': 'test-corr-2' }, { body }));

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ presignedUrl: 'http://localhost:9000/signed' });
      expect(operations.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: body.documentId, creatorId: 'usr_1', signerOrgId: 'org-a', draftHash: body.fileHash }),
        expect.objectContaining({ documentId: body.documentId, signerId: 'usr_1' }),
      );
      expect(coordinator.processNext).toHaveBeenCalledWith(body.documentId);
      expect(mockFindById).toHaveBeenCalledWith(body.documentId, { kind: 'organization', orgId: 'org-a' });
    });

    it('returns 400 for RECEIPT documents without a transferEventId', async () => {
      const result = await router.signDocument(request({}, { body: signBody({ documentType: 'RECEIPT', transferEventId: undefined }) }));

      expect(result.status).toBe(400);
      expect(coordinator.processNext).not.toHaveBeenCalled();
    });

    it('enqueues a receipt only for the recorded receiver', async () => {
      const transferEventId = '123e4567-e89b-42d3-a456-426614174000';
      mockFindById.mockResolvedValueOnce(mockEntity());
      getSignedDownloadUrl.mockResolvedValueOnce('http://localhost:9000/signed');
      mockFindTransferParticipants.mockResolvedValueOnce({ senderOrgId: 'org-b', receiverOrgId: 'org-a' });

      const result = await router.signDocument(request({}, { body: signBody({ documentType: 'RECEIPT', senderOrgId: 'org-b', receiverOrgId: 'org-a', transferEventId }) }));

      expect(result.status).toBe(200);
      expect(operations.enqueue).toHaveBeenCalledWith(expect.objectContaining({ operation: 'RECEIPT', transferEventId }), expect.anything());
    });

    it('refuses receipt signing if transfer participants are unavailable or the receiver differs', async () => {
      const body = signBody({ documentType: 'RECEIPT', senderOrgId: 'org-b', receiverOrgId: 'org-a', transferEventId: '123e4567-e89b-42d3-a456-426614174000' });
      mockFindTransferParticipants.mockResolvedValueOnce(null).mockResolvedValueOnce({
        senderOrgId: 'org-a', receiverOrgId: 'other-org',
      });

      expect((await router.signDocument(request({}, { body }))).status).toBe(409);
      expect((await router.signDocument(request({}, { body }))).status).toBe(403);
      expect(coordinator.processNext).not.toHaveBeenCalled();
    });

    it('reports pending reconciliation without returning a download URL', async () => {
      vi.mocked(operations.find).mockResolvedValueOnce({ state: 'SIGNED' } as never);
      const result = await router.signDocument(request({}, { body: signBody() }));
      expect(result.status).toBe(503);
      expect(result.body).toMatchObject({ code: 'SIGNING_PENDING' });
      expect(getSignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('rejects a different retry for the same draft before processing', async () => {
      vi.mocked(operations.enqueue).mockRejectedValueOnce(new SigningRequestConflict('different signature'));
      const result = await router.signDocument(request({}, { body: signBody() }));
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ code: 'SIGNING_REQUEST_CONFLICT' });
      expect(coordinator.processNext).not.toHaveBeenCalled();
    });

    it('does not report success when signing coordination fails', async () => {
      vi.mocked(coordinator.processNext).mockRejectedValueOnce(new Error('NATS timeout'));
      const result = await router.signDocument(request({}, { body: signBody() }));
      expect(result.status).toBe(500);
      expect(result.body).toMatchObject({ code: 'SIGNATURE_PROCESSING_FAILED' });
      expect(getSignedDownloadUrl).not.toHaveBeenCalled();
    });
  });
});
