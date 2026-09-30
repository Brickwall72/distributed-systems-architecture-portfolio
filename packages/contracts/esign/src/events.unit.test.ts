// File: packages/contracts/esign/src/events.unit.test.ts
import {
  ESIGN_EVENT_TYPES,
  ESIGN_SUBJECTS,
  DocumentSignedDataSchema,
  DocumentSignedEventSchema,
  DocumentRejectedDataSchema,
  DocumentRejectedEventSchema,
} from './events.js';

describe('ESign Event Constants', () => {
  it('should maintain strict NATS subject and CloudEvent type mappings', () => {
    expect(ESIGN_EVENT_TYPES.DOCUMENT_SIGNED).toBe('com.system.esign.document.signed');
    expect(ESIGN_EVENT_TYPES.DOCUMENT_REJECTED).toBe('com.system.esign.document.rejected');
    expect(ESIGN_SUBJECTS.DOCUMENT_SIGNED).toBe('events.esign.compliance.document.signed');
    expect(ESIGN_SUBJECTS.DOCUMENT_REJECTED).toBe('events.esign.compliance.document.rejected');
    expect(ESIGN_SUBJECTS.STREAM_NAME).toBe('ESIGN_EVENTS');
    expect(ESIGN_SUBJECTS.WILDCARD_ALL).toBe('events.esign.>');
  });
});

describe('DocumentSignedDataSchema', () => {
  const validData = {
    documentId: '123e4567-e89b-12d3-a456-426614174000',
    documentType: 'DD-1149',
    signerId: 'usr_usr_99128',
    entityId: 'org_77102',
    status: 'SIGNED' as const,
    signedAt: '2026-09-30T04:34:42.100Z',
  };

  it('should parse a minimal valid document signed payload', () => {
    const result = DocumentSignedDataSchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it('should parse a complete document signed payload with optional claim-check references', () => {
    const fullData = {
      ...validData,
      uploadedAt: '2026-09-30T04:30:00.000Z',
      s3Uri: 's3://esign-vault/signed/123e4567.pdf',
      storageBucket: 'esign-vault',
      storageKey: 'signed/123e4567.pdf',
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    const result = DocumentSignedDataSchema.parse(fullData);
    expect(result).toEqual(fullData);
  });

  it('should reject non-UUID documentId', () => {
    const invalid = { ...validData, documentId: 'invalid-uuid-format' };
    expect(() => DocumentSignedDataSchema.parse(invalid)).toThrow('documentId must be a valid UUID');
  });

  it('should reject invalid status literal', () => {
    const invalid = { ...validData, status: 'APPROVED' };
    expect(() => DocumentSignedDataSchema.parse(invalid)).toThrow();
  });

  it('should reject non-ISO 8601 timestamps for signedAt', () => {
    const invalid = { ...validData, signedAt: '2026-09-30 04:34:42' };
    expect(() => DocumentSignedDataSchema.parse(invalid)).toThrow('signedAt must be a valid ISO 8601 timestamp');
  });
});

describe('DocumentSignedEventSchema (CloudEvent)', () => {
  const validCloudEvent = {
    specversion: '1.0' as const,
    id: 'evt_signed_001',
    source: 'service:esign-service',
    type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
    time: '2026-09-30T04:34:42.105Z',
    datacontenttype: 'application/json' as const,
    correlationId: 'cid_corr_8812',
    data: {
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      documentType: 'DD-1149',
      signerId: 'usr_usr_99128',
      entityId: 'org_77102',
      status: 'SIGNED' as const,
      signedAt: '2026-09-30T04:34:42.100Z',
    },
  };

  it('should parse a fully formed CloudEvent envelope wrapping DocumentSignedData', () => {
    const result = DocumentSignedEventSchema.parse(validCloudEvent);
    expect(result).toEqual(validCloudEvent);
  });

  it('should reject CloudEvent with missing required CloudEvent header fields', () => {
    const { specversion, ...invalidEvent } = validCloudEvent;
    expect(() => DocumentSignedEventSchema.parse(invalidEvent)).toThrow();
  });
});

describe('DocumentRejectedDataSchema', () => {
  const validData = {
    documentId: '123e4567-e89b-12d3-a456-426614174000',
    documentType: 'TRANSFER_AUTHORIZATION',
    signerId: 'usr_usr_33104',
    entityId: 'org_88192',
    status: 'REJECTED' as const,
    reason: 'Signature line 2 missing required commanding officer signoff.',
    rejectedAt: '2026-09-30T04:35:00.000Z',
  };

  it('should parse a valid document rejected payload', () => {
    const result = DocumentRejectedDataSchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it('should reject empty rejection reason', () => {
    const invalid = { ...validData, reason: '' };
    expect(() => DocumentRejectedDataSchema.parse(invalid)).toThrow('Rejection reason is required');
  });

  it('should reject invalid status literal', () => {
    const invalid = { ...validData, status: 'REJECT' };
    expect(() => DocumentRejectedDataSchema.parse(invalid)).toThrow();
  });

  it('should reject non-ISO 8601 timestamps for rejectedAt', () => {
    const invalid = { ...validData, rejectedAt: '2026-09-30 04:35:00' };
    expect(() => DocumentRejectedDataSchema.parse(invalid)).toThrow('rejectedAt must be a valid ISO 8601 timestamp');
  });
});

describe('DocumentRejectedEventSchema (CloudEvent)', () => {
  const validCloudEvent = {
    specversion: '1.0' as const,
    id: 'evt_rejected_002',
    source: 'service:esign-service',
    type: ESIGN_EVENT_TYPES.DOCUMENT_REJECTED,
    time: '2026-09-30T04:35:00.010Z',
    datacontenttype: 'application/json' as const,
    data: {
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      documentType: 'TRANSFER_AUTHORIZATION',
      signerId: 'usr_usr_33104',
      entityId: 'org_88192',
      status: 'REJECTED' as const,
      reason: 'Signature missing.',
      rejectedAt: '2026-09-30T04:35:00.000Z',
    },
  };

  it('should parse a fully formed CloudEvent envelope wrapping DocumentRejectedData', () => {
    const result = DocumentRejectedEventSchema.parse(validCloudEvent);
    expect(result).toEqual(validCloudEvent);
  });
});