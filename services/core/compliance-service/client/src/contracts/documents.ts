// File: services/core/compliance-service/client/src/contracts/documents.ts
import { z } from 'zod';

export const ComplianceDocumentSchema = z.object({
  id: z.string().uuid(),
  document_type: z.string(),
  s3_uri: z.string(),
  status: z.enum(['Pending', 'Approved', 'Rejected']).default('Pending'),
  created_at: z.string().datetime(),
}).catchall(z.unknown()); // Catch-all allows raw SELECT * extra columns for now

export type ComplianceDocument = z.infer<typeof ComplianceDocumentSchema>;