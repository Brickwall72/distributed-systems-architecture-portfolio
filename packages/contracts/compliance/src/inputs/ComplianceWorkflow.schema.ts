// File: packages/contracts/compliance/src/inputs/ComplianceWorkflow.schema.ts
import { z } from 'zod';
import { AssetDTOSchema } from '@contracts/topology';

// ==========================================
//   COMPLIANCE WORKFLOW PAYLOAD CONTRACT
// ==========================================
/**
 * The payload the Shell constructs and passes into ComplianceWorkflowWidget.
 */
export const ComplianceWorkflowPayloadSchema = z.object({
  // sourceOrganization: BaseOrganizationSchema,
  // targetOrganization: BaseOrganizationSchema,
  assets: z.array(AssetDTOSchema).min(1, 'At least one asset is required'),
});

export type ComplianceWorkflowPayload = z.infer<typeof ComplianceWorkflowPayloadSchema>;