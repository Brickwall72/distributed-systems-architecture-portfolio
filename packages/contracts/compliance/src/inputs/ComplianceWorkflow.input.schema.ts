// File: packages/contracts/compliance/src/inputs/ComplianceWorkflow.schema.ts
import { transferTypeEnum, TransferType } from '@contracts/common';
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

/**
 * Domain classification enum for official compliance templates.
 */
export const FORM_TYPE = {
  AUTHORIZATION: 'AUTHORIZATION',
  RECEIPT: 'RECEIPT',
} as const;
export const formTypeEnum = z.enum(
  Object.values(FORM_TYPE) as [typeof FORM_TYPE[keyof typeof FORM_TYPE], ...typeof FORM_TYPE[keyof typeof FORM_TYPE][]]
);
export type FormType = z.infer<typeof formTypeEnum>;

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
  transferType: transferTypeEnum.optional(),
  formType: formTypeEnum.optional(),
});

// ============================================================================
//      TYPES: INGRESS PROPS vs PARSED STATE
// ============================================================================

/**
 * External props accepted by `ComplianceWorkflowWidget` from the Host Shell in JSX.
 * Uses `z.input` so `assets` is optional (`assets?: AssetDTO[]`).
 */
export type ComplianceWorkflowWidgetProps = z.infer<typeof ComplianceWorkflowWidgetPropsSchema> & { readonly onSelect: (transferType: TransferType | undefined) => void };