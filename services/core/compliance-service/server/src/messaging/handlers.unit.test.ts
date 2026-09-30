// File: services/core/compliance-service/server/src/messaging/handlers.unit.test.ts
import { handleDocumentSignedEvent, handleDocumentRejectedEvent } from './handlers.js';
import { ComplianceDocumentRepository } from '../db/documents.repository.js';
import { ESIGN_EVENT_TYPES } from '@contracts/esign';

describe('Event Handlers', () => {
  let mockRepository: { create: ReturnType<typeof vi.fn> };

  const baseEvent = {
    specversion: '1.0',
    id: 'evt_test_1001',
    source: 'service:esign-server',
    time: '2026-09-27T12:00:00.000Z',
    datacontenttype: 'application/json',
    correlationId: 'cid_test_88192',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = {
      create: vi.fn().mockResolvedValue({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        document_type: 'DD-1149',
        s3_uri: 's3://compliance-documents/DD-1149/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11.pdf',
        status: 'Approved',
        created_at: new Date().toISOString(),
      }),
    };
  });

  describe('handleDocumentSignedEvent', () => {
    it('successfully processes event with explicit s3Uri and status Approved', async () => {
      const payload = {
        ...baseEvent,
        type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
        data: {
          documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          documentType: 'DD-1149',
          signerId: 'usr_4412',
          entityId: 'clr_9910',
          status: 'SIGNED',
          s3Uri: 's3://explicit-bucket/doc.pdf',
          signedAt: '2026-09-27T12:00:00.000Z',
        },
      };

      await handleDocumentSignedEvent(payload, mockRepository as unknown as ComplianceDocumentRepository);

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          document_type: 'DD-1149',
          s3_uri: 's3://explicit-bucket/doc.pdf',
          status: 'Approved',
        })
      );
    });

    it('resolves S3 URI using Claim-Check storageBucket and storageKey when s3Uri is omitted', async () => {
      const payload = {
        ...baseEvent,
        type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
        data: {
          documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          documentType: 'DD-1149',
          signerId: 'usr_4412',
          entityId: 'clr_9910',
          status: 'SIGNED',
          storageBucket: 'my-minio-bucket',
          storageKey: '/folder/document.pdf',
          signedAt: '2026-09-27T12:00:00.000Z',
        },
      };

      await handleDocumentSignedEvent(payload, mockRepository as unknown as ComplianceDocumentRepository);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          s3_uri: 's3://my-minio-bucket/folder/document.pdf',
        })
      );
    });

    it('falls back to default S3 URI structure when no storage references are provided', async () => {
      const payload = {
        ...baseEvent,
        type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
        data: {
          documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          documentType: 'DD-1149',
          signerId: 'usr_4412',
          entityId: 'clr_9910',
          status: 'SIGNED',
          signedAt: '2026-09-27T12:00:00.000Z',
        },
      };

      await handleDocumentSignedEvent(payload, mockRepository as unknown as ComplianceDocumentRepository);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          s3_uri: 's3://compliance-documents/DD-1149/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11.pdf',
        })
      );
    });

    it('throws a Zod error if the payload fails schema validation', async () => {
      const invalidPayload = {
        ...baseEvent,
        type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
        data: {
          documentId: 'not-a-uuid', // Invalid UUID
        },
      };

      await expect(
        handleDocumentSignedEvent(invalidPayload, mockRepository as unknown as ComplianceDocumentRepository)
      ).rejects.toThrow();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('handleDocumentRejectedEvent', () => {
    it('successfully processes rejection event and records status as Rejected', async () => {
      const payload = {
        ...baseEvent,
        type: ESIGN_EVENT_TYPES.DOCUMENT_REJECTED,
        data: {
          documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          documentType: 'DD-1149',
          signerId: 'usr_4412',
          entityId: 'clr_9910',
          status: 'REJECTED',
          reason: 'Signature mismatch',
          rejectedAt: '2026-09-27T12:00:00.000Z',
        },
      };

      await handleDocumentRejectedEvent(payload, mockRepository as unknown as ComplianceDocumentRepository);

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          document_type: 'DD-1149',
          status: 'Rejected',
          s3_uri: 's3://compliance-documents/DD-1149/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11.pdf',
        })
      );
    });
  });
});