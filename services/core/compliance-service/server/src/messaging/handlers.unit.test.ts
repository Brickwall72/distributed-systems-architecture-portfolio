// File: services/core/compliance-service/server/src/messaging/handlers.unit.test.ts
import { handleDocumentSignedEvent, handleDocumentRejectedEvent } from './handlers.js';
import { ComplianceDocumentRepository } from '../repositories';
import { ESIGN_EVENT_TYPES } from '@contracts/esign';

describe('Event Handlers', () => {
  let mockRepository: { upsert: ReturnType<typeof vi.fn> };

  const baseResponse = {
    success: true,
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    documentType: 'DD-1149',
    signerId: 'usr_4412',
    entityId: 'clr_9910',
    status: 'SIGNED' as const,
    storageBucket: 'explicit-bucket',
    storageKey: 'doc.pdf',
    s3Uri: 's3://explicit-bucket/doc.pdf',
    presignedUrl: 'http://localhost:9000/explicit-bucket/doc.pdf?signature=123',
    fileHash: 'a'.repeat(64),
    signedAt: '2026-09-27T12:00:00.000Z',
    uploadedAt: '2026-09-27T12:00:01.000Z',
    createdAt: '2026-09-27T12:00:00.000Z',
    updatedAt: '2026-09-27T12:00:00.000Z',
    correlationId: 'cid_test_88192',
  };

  const baseEvent = {
    specversion: '1.0' as const,
    id: 'evt_test_1001',
    source: 'service:esign-server',
    type: 'com.system.esign.document.rejected',
    time: '2026-09-27T12:00:00.000Z',
    datacontenttype: 'application/json' as const,
    correlationId: 'cid_test_88192',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = {
      upsert: vi.fn().mockResolvedValue({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        documentType: 'DD-1149',
        storageBucket: 'explicit-bucket',
        storageKey: 'doc.pdf',
        status: 'SIGNED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    };
  });

  describe('handleDocumentSignedEvent', () => {
    it('successfully processes synchronous response with explicit storage references and status SIGNED', async () => {
      await handleDocumentSignedEvent(baseResponse, mockRepository as unknown as ComplianceDocumentRepository);

      expect(mockRepository.upsert).toHaveBeenCalledTimes(1);
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          documentType: 'DD-1149',
          bucket: 'explicit-bucket',
          objectKey: 'doc.pdf',
          status: 'SIGNED',
        })
      );
    });

    it('throws a Zod error if the payload fails schema validation', async () => {
      const invalidPayload = {
        ...baseResponse,
        id: 'not-a-uuid', // Invalid UUID
      };

      await expect(
        handleDocumentSignedEvent(invalidPayload, mockRepository as unknown as ComplianceDocumentRepository)
      ).rejects.toThrow();
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('handleDocumentRejectedEvent', () => {
    it('successfully processes rejection event and records status as REJECTED', async () => {
      const payload = {
        ...baseEvent,
        type: ESIGN_EVENT_TYPES.DOCUMENT_REJECTED,
        data: {
          documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          documentType: 'DD-1149',
          signerId: 'usr_4412',
          entityId: 'clr_9910',
          status: 'REJECTED' as const,
          reason: 'Signature mismatch',
          rejectedAt: '2026-09-27T12:00:00.000Z',
        },
      };

      await handleDocumentRejectedEvent(payload, mockRepository as unknown as ComplianceDocumentRepository);

      expect(mockRepository.upsert).toHaveBeenCalledTimes(1);
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          documentType: 'DD-1149',
          status: 'REJECTED',
        })
      );
    });
  });
});