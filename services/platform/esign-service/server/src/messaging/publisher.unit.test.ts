// File: services/platform/esign-service/server/src/messaging/publisher.unit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBroker } from '@shared/messaging';
import {
  ESIGN_SUBJECTS,
  ESIGN_EVENT_TYPES,
  DocumentSignedData,
  DocumentRejectedData,
} from '@contracts/esign';
import {
  ESignPublisher,
  setESignPublisher,
  getESignPublisher,
} from './publisher.js';

describe('ESignPublisher', () => {
  let mockBroker: EventBroker;
  let publisher: ESignPublisher;

  // Use valid UUID v4 strings to satisfy Zod schema constraints
  const validDocumentIdSigned = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const validDocumentIdRejected = 'c9bf9e57-1685-4c89-bafb-ff5af830be8a';

  const sampleSignedData: DocumentSignedData = {
    documentId: validDocumentIdSigned,
    documentType: 'DD-1149',
    signerId: 'usr_actor_404',
    entityId: 'org_armory_01',
    status: 'SIGNED',
    signedAt: '2026-09-29T22:00:00.000Z',
    s3Uri: `s3://compliance-documents/org_armory_01/${validDocumentIdSigned}.pdf`,
    fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  const sampleRejectedData: DocumentRejectedData = {
    documentId: validDocumentIdRejected,
    documentType: 'DD-1149',
    signerId: 'usr_actor_404',
    entityId: 'org_armory_01',
    status: 'REJECTED',
    rejectedAt: '2026-09-29T22:05:00.000Z',
    reason: 'Signature image unreadable',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBroker = {
      ensureStream: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventBroker;

    publisher = new ESignPublisher(mockBroker);
    setESignPublisher(undefined as unknown as ESignPublisher);
  });

  describe('Singleton Manager Functions', () => {
    it('should manage publisher instance singleton state', () => {
      expect(getESignPublisher()).toBeUndefined();

      setESignPublisher(publisher);

      expect(getESignPublisher()).toBe(publisher);
    });
  });

  describe('init', () => {
    it('should initialize NATS JetStream stream with configured wildcards', async () => {
      await publisher.init();

      expect(mockBroker.ensureStream).toHaveBeenCalledTimes(1);
      expect(mockBroker.ensureStream).toHaveBeenCalledWith(
        ESIGN_SUBJECTS.STREAM_NAME,
        [ESIGN_SUBJECTS.WILDCARD_ALL]
      );
    });
  });

  describe('publishDocumentSigned', () => {
    it('should construct, validate, and publish CloudEvent with provided correlationId', async () => {
      const customCorrelationId = 'cid_trace_881920';

      await publisher.publishDocumentSigned({
        data: sampleSignedData,
        correlationId: customCorrelationId,
      });

      expect(mockBroker.publish).toHaveBeenCalledTimes(1);

      const [subject, publishedEvent, correlationIdParam] = (
        mockBroker.publish as ReturnType<typeof vi.fn>
      ).mock.calls[0];

      expect(subject).toBe(ESIGN_SUBJECTS.DOCUMENT_SIGNED);
      expect(correlationIdParam).toBe(customCorrelationId);

      expect(publishedEvent).toMatchObject({
        specversion: '1.0',
        source: 'service:esign-server',
        type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
        datacontenttype: 'application/json',
        correlationId: customCorrelationId,
        data: sampleSignedData,
      });

      expect(publishedEvent.id).toMatch(/^evt_[a-f0-9-]+$/);
      expect(publishedEvent.time).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should auto-generate cid_ prefix correlationId when omitted', async () => {
      await publisher.publishDocumentSigned({
        data: sampleSignedData,
      });

      const [_, publishedEvent, correlationIdParam] = (
        mockBroker.publish as ReturnType<typeof vi.fn>
      ).mock.calls[0];

      expect(correlationIdParam).toMatch(/^cid_[a-f0-9-]+$/);
      expect(publishedEvent.correlationId).toBe(correlationIdParam);
    });

    it('should fail fast and prevent publishing if payload violates Zod contract schema', async () => {
      const invalidData = {
        ...sampleSignedData,
        documentId: 'invalid-non-uuid-id',
      } as unknown as DocumentSignedData;

      await expect(
        publisher.publishDocumentSigned({
          data: invalidData,
        })
      ).rejects.toThrow();

      expect(mockBroker.publish).not.toHaveBeenCalled();
    });
  });

  describe('publishDocumentRejected', () => {
    it('should construct, validate, and publish rejection CloudEvent', async () => {
      const correlationId = 'cid_reject_1002';

      await publisher.publishDocumentRejected({
        data: sampleRejectedData,
        correlationId,
      });

      expect(mockBroker.publish).toHaveBeenCalledTimes(1);

      const [subject, publishedEvent, correlationIdParam] = (
        mockBroker.publish as ReturnType<typeof vi.fn>
      ).mock.calls[0];

      expect(subject).toBe(ESIGN_SUBJECTS.DOCUMENT_REJECTED);
      expect(correlationIdParam).toBe(correlationId);

      expect(publishedEvent).toMatchObject({
        specversion: '1.0',
        source: 'service:esign-server',
        type: ESIGN_EVENT_TYPES.DOCUMENT_REJECTED,
        datacontenttype: 'application/json',
        correlationId,
        data: sampleRejectedData,
      });
    });

    it('should block publish if rejection payload schema is invalid', async () => {
      const invalidData = {
        ...sampleRejectedData,
        reason: 12345, // Invalid type
      } as unknown as DocumentRejectedData;

      await expect(
        publisher.publishDocumentRejected({
          data: invalidData,
        })
      ).rejects.toThrow();

      expect(mockBroker.publish).not.toHaveBeenCalled();
    });
  });
});