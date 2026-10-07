// File: packages/contracts/compliance/src/documents.ts
import { z } from 'zod';

export const ComplianceDocumentStatusSchema = z.enum(['Pending', 'Approved', 'Rejected']);
export type ComplianceDocumentStatus = z.infer<typeof ComplianceDocumentStatusSchema>;

// Read DTO: Represents the full record returned by DB / API
export const ComplianceDocumentSchema = z.object({
  id: z.string().uuid(),
  document_type: z.string().min(1),
  s3_uri: z.string().startsWith('s3://', { message: 'Must be a valid S3 URI' }),
  status: ComplianceDocumentStatusSchema,
  created_at: z.string().datetime(),
});

export type ComplianceDocument = z.infer<typeof ComplianceDocumentSchema>;

// Creation Input DTO: Validates incoming payloads BEFORE DB insertion
export const CreateComplianceDocumentSchema = ComplianceDocumentSchema.omit({
  created_at: true,
}).extend({
  // Make status optional for creation, defaulting to 'Pending' if omitted
  status: ComplianceDocumentStatusSchema.optional().default('Pending'),
});

export type CreateComplianceDocument = z.infer<typeof CreateComplianceDocumentSchema>;