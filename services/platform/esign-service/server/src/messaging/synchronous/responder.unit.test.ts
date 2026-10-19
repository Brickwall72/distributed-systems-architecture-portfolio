// File: services/platform/esign-service/server/src/messaging/synchronous/responder.unit.test.ts
import { registerESignResponder } from './responder';
import { EventBroker } from '@shared/messaging';
import { signDocumentFromStorage, uploadSignedDocument, publicStorageClient } from '../../services';
import { ESIGN_COMMAND_SUBJECTS } from '@contracts/esign';

vi.mock('@shared/messaging');
vi.mock('../../services', () => ({
  signDocumentFromStorage: vi.fn(),
  uploadSignedDocument: vi.fn(),
  publicStorageClient: {
    getSignedDownloadUrl: vi.fn(),
  },
}));

describe('registerESignResponder', () => {
  let mockBroker: EventBroker;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBroker = {
      respond: vi.fn(),
    } as unknown as EventBroker;
  });

  it('handles sign-document requests correctly using the claim-check and public URL pattern', async () => {
    let responderCallback: (payload: any) => Promise<any>;
    vi.mocked(mockBroker.respond).mockImplementation((subject, cb) => {
      if (subject === ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT) {
        responderCallback = cb;
      }
    });

    registerESignResponder(mockBroker);

    expect(mockBroker.respond).toHaveBeenCalledWith(
      ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT,
      expect.any(Function)
    );

    // Mock service responses
    vi.mocked(signDocumentFromStorage).mockResolvedValueOnce({
      pdfBuffer: Buffer.from('signed-pdf'),
      signedAt: '2026-10-18T21:00:00.000Z',
    });

    const validSha256Hash = 'a'.repeat(64);
    vi.mocked(uploadSignedDocument).mockResolvedValueOnce({
      bucket: 'dsap',
      key: 'tenant-123/123e4567-e89b-12d3-a456-426614174000.pdf',
      s3Uri: 's3://dsap/tenant-123/123e4567-e89b-12d3-a456-426614174000.pdf',
      fileHash: validSha256Hash,
      uploadedAt: '2026-10-18T21:00:01.000Z',
    });

    vi.mocked(publicStorageClient.getSignedDownloadUrl).mockResolvedValueOnce(
      'http://localhost:9000/dsap/tenant-123/123e4567-e89b-12d3-a456-426614174000.pdf?signature=xyz'
    );

    const testUuid = '123e4567-e89b-12d3-a456-426614174000';
    const requestPayload = {
      storageBucket: 'dsap',
      storageKey: 'tenant-123/source.pdf',
      signatureImageBase64: 'base64sig',
      documentId: testUuid,
      documentType: 'transfer-form',
      signerId: 'user-789',
      entityId: 'tenant-123',
      correlationId: 'corr-abc',
    };

    const response = await responderCallback!(requestPayload);

    expect(signDocumentFromStorage).toHaveBeenCalledWith({
      storageBucket: 'dsap',
      storageKey: 'tenant-123/source.pdf',
      signatureImageBase64: 'base64sig',
      correlationId: 'corr-abc',
    });

    expect(uploadSignedDocument).toHaveBeenCalledWith({
      pdfBuffer: expect.any(Buffer),
      entityId: 'tenant-123',
      documentId: testUuid,
      customPath: undefined,
      correlationId: 'corr-abc',
    });

    expect(publicStorageClient.getSignedDownloadUrl).toHaveBeenCalledWith(
      'dsap',
      'tenant-123/123e4567-e89b-12d3-a456-426614174000.pdf',
      600
    );

    expect(response).toMatchObject({
      success: true,
      id: testUuid,
      documentType: 'transfer-form',
      signerId: 'user-789',
      entityId: 'tenant-123',
      status: 'SIGNED',
      storageBucket: 'dsap',
      storageKey: 'tenant-123/123e4567-e89b-12d3-a456-426614174000.pdf',
      presignedUrl: 'http://localhost:9000/dsap/tenant-123/123e4567-e89b-12d3-a456-426614174000.pdf?signature=xyz',
      fileHash: validSha256Hash,
      correlationId: 'corr-abc',
    });
  });
});