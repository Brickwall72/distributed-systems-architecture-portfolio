// File: services/core/compliance-service/server/src/routes/documents/documents.route.unit.test.ts
import { createDocumentsRouter } from './documents.route';
import { DocumentsRepository, insertDataSchema } from '../../repositories';
import { documentEntitySchema } from '../../domain';
import type { CompliancePublisher } from '../../messaging';
import { EventBroker } from '@shared/messaging';
import { ESIGN_COMMAND_SUBJECTS, SignDocumentCommandSchema, SignDocumentResponseSchema } from '@contracts/esign';
import { transferInitiatedDataSchema } from '@contracts/compliance';
import { DocumentSchema, signDocumentApiRequestSchema } from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';

vi.mock('../../db', () => ({ pool: {} }));

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockInsert = vi.fn();

vi.mock('../../repositories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../repositories')>();
  return {
    ...actual,
    DocumentsRepository: class {
      findAll = () => mockFindAll();
      findById = (id: string) => mockFindById(id);
      insert = (data: unknown) => mockInsert(data);
    },
  };
});

const mockEntity = (overrides: Partial<Parameters<typeof documentEntitySchema.parse>[0]> = {}) =>
  mockFromSchema(documentEntitySchema, overrides);

const request = (headers: Record<string, string> = {}, extra: object = {}) =>
  ({ query: {}, params: {}, req: { headers }, ...extra }) as never;

describe('Documents Router Unit Tests', () => {
  let router: ReturnType<typeof createDocumentsRouter>;
  let mockBroker: { request: ReturnType<typeof vi.fn> };
  let mockPublisher: { publishTransferInitiated: ReturnType<typeof vi.fn>; publishTransferReceived: ReturnType<typeof vi.fn> };
  let repository: DocumentsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBroker = { request: vi.fn() };
    mockPublisher = { publishTransferInitiated: vi.fn(), publishTransferReceived: vi.fn() };
    repository = new DocumentsRepository({} as never);
    router = createDocumentsRouter({
      broker: mockBroker as unknown as EventBroker,
      publisher: mockPublisher as unknown as CompliancePublisher,
      repository,
    });
  });

  describe('GET /documents', () => {
    it('returns 200 with API-contract documents when repository succeeds', async () => {
      const docs = [mockEntity(), mockEntity()];
      mockFindAll.mockResolvedValueOnce(docs);

      const result = await router.getDocuments(request({ 'x-correlation-id': 'test-corr-1' }));

      expect(result.status).toBe(200);
      expect(result.body).toEqual(docs.map((doc) => DocumentSchema.parse(doc)));
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
      expect(mockFindById).toHaveBeenCalledWith(doc.id);
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
    const signBody = (overrides = {}) =>
      mockFromSchema(signDocumentApiRequestSchema, {
        signerId: 'usr_1',
        documentName: 'asset-transfer-authorization',
        documentType: 'AUTHORIZATION',
        ...overrides,
      });

    const signResponse = (overrides = {}) =>
      mockFromSchema(SignDocumentResponseSchema, { success: true, fileHash: SHA256_HEX, ...overrides });

    it('sends a globally-contracted command, persists, publishes a contract-valid event, and returns the presigned URL', async () => {
      const body = signBody();
      const response = signResponse();
      mockBroker.request.mockResolvedValueOnce(response);
      mockInsert.mockResolvedValueOnce(mockEntity({ type: 'AUTHORIZATION' }));

      const result = await router.signDocument(request({ 'x-correlation-id': 'test-corr-2' }, { body }));

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ presignedUrl: response.presignedUrl });

      const [subject, payload, options] = mockBroker.request.mock.calls[0];
      expect(subject).toBe(ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT);
      expect(SignDocumentCommandSchema.parse(payload)).toEqual(payload);
      expect(options).toEqual({ timeout: 10000, correlationId: 'test-corr-2' });

      expect(insertDataSchema.parse(mockInsert.mock.calls[0][0])).toMatchObject({ status: 'SIGNED', fileHash: response.fileHash });

      const [eventData, correlationId] = mockPublisher.publishTransferInitiated.mock.calls[0];
      expect(transferInitiatedDataSchema.parse(eventData)).toEqual(eventData);
      expect(correlationId).toBe('test-corr-2');
      expect(mockPublisher.publishTransferReceived).not.toHaveBeenCalled();
    });

    it('does not publish transfer-received for RECEIPT documents until the transferId lookup exists', async () => {
      mockBroker.request.mockResolvedValueOnce(signResponse());
      mockInsert.mockResolvedValueOnce(mockEntity({ type: 'RECEIPT' }));

      const result = await router.signDocument(request({}, { body: signBody({ documentType: 'RECEIPT' }) }));

      expect(result.status).toBe(200);
      expect(mockPublisher.publishTransferReceived).not.toHaveBeenCalled();
    });

    it.todo('publishes a transfer-received event with the transferId looked up from the compliance database');

    it('returns 500 when the esign service reports failure', async () => {
      mockBroker.request.mockResolvedValueOnce(signResponse({ success: false }));

      const result = await router.signDocument(request({}, { body: signBody() }));

      expect(result.status).toBe(500);
      expect(result.body).toMatchObject({ error: 'Remote signature generation failed.', code: 'SIGNATURE_PROCESSING_FAILED' });
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('returns 500 when the esign reply violates the shared response contract', async () => {
      mockBroker.request.mockResolvedValueOnce({ success: true });

      const result = await router.signDocument(request({}, { body: signBody() }));

      expect(result.status).toBe(500);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('returns 500 when broker request throws', async () => {
      mockBroker.request.mockRejectedValueOnce(new Error('NATS timeout'));

      const result = await router.signDocument(request({}, { body: signBody() }));

      expect(result.status).toBe(500);
      expect(result.body).toEqual(
        expect.objectContaining({ error: 'NATS timeout', code: 'SIGNATURE_PROCESSING_FAILED', timestamp: expect.any(String) }),
      );
    });
  });
});
