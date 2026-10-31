// File: packages/contracts/compliance/src/inputs/ComplianceWorkflow.schema.ts
import { templateDTOwithPayloadSchema } from './TemplateSelector.input.schema';
import { z } from 'zod';

const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
});
const assetSchema = z.object({
  id: z.string(),
  nomenclature: z.string(),
  serialNumber: z.string(),
  type: z.string().optional(),
})

// ============================================================================
//    COMPLIANCE WORKFLOW WIDGET CONTRACT
// ============================================================================

/**
 * Runtime input schema enforced at the MFE boundary.
 *
 * `sourceOrg` and `targetOrg` are marked `.optional()` to allow
 * the Host Shell to mount this widget before the user completes selection states.
 */
export const ComplianceWorkflowWidgetPropsSchema = z.object({
  sourceOrg: organizationSchema.optional(),
  targetOrg: organizationSchema.optional(),
  assets: z.array(assetSchema).default([]),
  template: templateDTOwithPayloadSchema.optional(),
});

// ============================================================================
//      TYPES: INGRESS PROPS vs PARSED STATE
// ============================================================================

/**
 * External props accepted by `ComplianceWorkflowWidget` from the Host Shell in JSX.
 * Uses `z.input` so `assets` is optional (`assets?: AssetDTO[]`).
 */
export type ComplianceWorkflowWidgetProps = z.infer<typeof ComplianceWorkflowWidgetPropsSchema>;