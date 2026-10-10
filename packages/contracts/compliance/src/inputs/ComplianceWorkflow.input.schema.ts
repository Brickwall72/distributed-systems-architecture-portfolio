// File: packages/contracts/compliance/src/inputs/ComplianceWorkflow.schema.ts
import { z } from 'zod';
import { AssetDTOListSchema, OrganizationDTOSchema } from '@contracts/topology';

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
  sourceOrg: OrganizationDTOSchema.optional(),
  targetOrg: OrganizationDTOSchema.optional(),
  assets: AssetDTOListSchema.default([]),
});

// ============================================================================
//      TYPES: INGRESS PROPS vs PARSED STATE
// ============================================================================

/**
 * External props accepted by `ComplianceWorkflowWidget` from the Host Shell in JSX.
 * Uses `z.input` so `assets` is optional (`assets?: AssetDTO[]`).
 */
export type ComplianceWorkflowWidgetProps = z.input<typeof ComplianceWorkflowWidgetPropsSchema>;

/**
 * Internal parsed state after `ComplianceWorkflowWidgetPropsSchema.safeParse(props)`.
 * Uses `z.output` (`z.infer`) so `assets` is guaranteed to be an array (`AssetDTO[]`).
 */
export type ComplianceWorkflowWidgetParsedProps = z.output<typeof ComplianceWorkflowWidgetPropsSchema>;