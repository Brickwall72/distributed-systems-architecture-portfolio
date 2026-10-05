// File: packages/contracts/compliance/src/documents.unit.test.ts
import {
  ComplianceDocumentStatusSchema,
  ComplianceDocumentSchema,
  CreateComplianceDocumentSchema,
} from './documents.js';

describe('Compliance Document Schemas', () => {
  describe('ComplianceDocumentStatusSchema', () => {
    it('should accept valid status enum values', () => {
      expect(ComplianceDocumentStatusSchema.parse('Pending')).toBe('Pending');
      expect(ComplianceDocumentStatusSchema.parse('Approved')).toBe('Approved');
      expect(ComplianceDocumentStatusSchema.parse('Rejected')).toBe('Rejected');
    });

    it('should reject invalid status values', () => {
      expect(() => ComplianceDocumentStatusSchema.parse('Draft')).toThrow();
      expect(() => ComplianceDocumentStatusSchema.parse('APPROVED')).toThrow();
      expect(() => ComplianceDocumentStatusSchema.parse('InReview')).toThrow();
    });
  });

  describe('ComplianceDocumentSchema', () => {
    const validDocument = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'DD-1149',
      s3_uri: 's3://dsap/DD-1149/123e4567.pdf',
      status: 'Approved' as const,
      created_at: '2026-09-30T04:34:42.100Z',
    };

    it('should parse a valid complete compliance document record', () => {
      const result = ComplianceDocumentSchema.parse(validDocument);
      expect(result).toEqual(validDocument);
    });

    it('should reject invalid UUIDs', () => {
      const invalid = { ...validDocument, id: 'not-a-uuid' };
      expect(() => ComplianceDocumentSchema.parse(invalid)).toThrow();
    });

    it('should reject empty document_type string', () => {
      const invalid = { ...validDocument, document_type: '' };
      expect(() => ComplianceDocumentSchema.parse(invalid)).toThrow();
    });

    it('should reject s3_uri that does not start with s3://', () => {
      const invalid = {
        ...validDocument,
        s3_uri: 'https://minio.local/dsap/file.pdf',
      };
      expect(() => ComplianceDocumentSchema.parse(invalid)).toThrow();
    });

    it('should reject non-ISO datetime strings for created_at', () => {
      const invalid = { ...validDocument, created_at: '2026-09-30 04:34:42' };
      expect(() => ComplianceDocumentSchema.parse(invalid)).toThrow();
    });
  });

  describe('CreateComplianceDocumentSchema', () => {
    const validCreateInput = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'TRANSFER_AUTHORIZATION',
      s3_uri: 's3://dsap/TRANSFER_AUTHORIZATION/123e4567.pdf',
    };

    it('should parse valid input and apply default status "Pending" when status is omitted', () => {
      const result = CreateComplianceDocumentSchema.parse(validCreateInput);
      expect(result).toEqual({
        ...validCreateInput,
        status: 'Pending',
      });
    });

    it('should accept explicit status when provided', () => {
      const input = { ...validCreateInput, status: 'Approved' as const };
      const result = CreateComplianceDocumentSchema.parse(input);
      expect(result.status).toBe('Approved');
    });

    it('should ignore created_at if provided because it is omitted from the schema', () => {
      const input = {
        ...validCreateInput,
        created_at: '2026-09-30T04:34:42.100Z',
      };
      const result = CreateComplianceDocumentSchema.parse(input);
      expect(result).not.toHaveProperty('created_at');
    });
  });
});