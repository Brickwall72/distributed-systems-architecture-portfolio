// File: services/platform/pdf-generator/server/src/messaging/responder.unit.test.ts
import { EventBroker } from '@shared/messaging';
import { PDF_SUBJECTS } from '@contracts/pdf';
import { registerPdfResponder } from './responder';
import * as services from '../services';
import { InMemoryStorageClient } from '@shared/filestore';

// Mock dependencies
vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services')>();
  return {
    ...actual,
    generatePdfFromHtml: vi.fn(),
    uploadGeneratedDocument: vi.fn(),
    publicStorageClient: {
      getSignedDownloadUrl: vi.fn(),
    },
  };
});

describe('PDF Generator NATS Responder', () => {
  let mockBroker: EventBroker;
  let registeredHandler: (payload: unknown) => Promise<unknown>;
  let memoryStorage: InMemoryStorageClient;

  beforeEach(() => {
    vi.clearAllMocks();
    memoryStorage = new InMemoryStorageClient();

    // Create a mock EventBroker where `respond` captures the handler callback
    mockBroker = {
      respond: vi.fn((_subject, handler) => {
        registeredHandler = handler;
        return Promise.resolve();
      }),
    } as unknown as EventBroker;
  });

  it('registers successfully on the correct NATS subject', async () => {
    registerPdfResponder(mockBroker);
    expect(mockBroker.respond).toHaveBeenCalledWith(
      PDF_SUBJECTS.GENERATE_DRAFT,
      expect.any(Function)
    );
  });

  it('successfully processes request, generates PDF, uploads, creates pre-signed URL, and returns response schema', async () => {
    // Arrange
    const documentId = '123e4567-e89b-12d3-a456-426614174000';
    const requestPayload = {
      html: '<h1>Test PDF</h1>',
      documentId,
      documentType: 'invoice',
      entityId: 'org-test',
      customPath: 'drafts',
      correlationId: 'corr-123',
    };

    const mockPdfBuffer = Buffer.from('mock-pdf-bytes');
    vi.mocked(services.generatePdfFromHtml).mockResolvedValue(mockPdfBuffer);

    const mockUploadResult = {
      s3Uri: 's3://drafts/org-test/drafts/123e4567-e89b-12d3-a456-426614174000.pdf',
      bucket: 'drafts',
      key: 'org-test/drafts/123e4567-e89b-12d3-a456-426614174000.pdf',
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // 64-char hex string
      uploadedAt: new Date().toISOString(),
    };
    vi.mocked(services.uploadGeneratedDocument).mockResolvedValue(mockUploadResult);

    const mockPresignedUrl = 'http://localhost:9000/drafts/org-test/drafts/123.pdf?signature=xyz';
    vi.mocked(services.publicStorageClient.getSignedDownloadUrl).mockResolvedValue(mockPresignedUrl);

    // Act
    registerPdfResponder(mockBroker);
    const response = await registeredHandler(requestPayload);

    // Assert
    expect(services.generatePdfFromHtml).toHaveBeenCalledWith('<h1>Test PDF</h1>', 'corr-123');
    expect(services.uploadGeneratedDocument).toHaveBeenCalledWith({
      pdfBuffer: mockPdfBuffer,
      entityId: 'org-test',
      documentId,
      customPath: 'drafts',
      correlationId: 'corr-123',
    });
    expect(services.publicStorageClient.getSignedDownloadUrl).toHaveBeenCalledWith(
      'drafts',
      mockUploadResult.key,
      600
    );

    expect(response).toEqual({
      success: true,
      id: documentId,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      s3Uri: mockUploadResult.s3Uri,
      storageBucket: 'drafts',
      storageKey: mockUploadResult.key,
      presignedUrl: mockPresignedUrl,
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      correlationId: 'corr-123',
    });
  });

  it('throws validation error on malformed NATS request payloads', async () => {
    registerPdfResponder(mockBroker);

    // Missing required fields like documentId and html
    const invalidPayload = {
      html: '',
    };

    await expect(registeredHandler(invalidPayload)).rejects.toThrow();
  });
});