// File: services/core/compliance-service/shared/src/schemas/DTO/template.dto.schema.ts
import { z } from 'zod';
import { transferTypeEnum } from '@contracts/common';

// ==========================================
//    COMPLIANCE INTRA-SERVICE TEMPLATE CONTRACT
// ==========================================

/**
 * Canonical template identifier enum governing valid system forms.
 */
export const FORM_ID = {
  ASSET_TRANSFER_AUTHORIZATION: 'asset-transfer-authorization',
  ASSET_TRANSFER_RECEIPT: 'asset-transfer-receipt',
  AUTHORITY_TRANSFER_AUTHORIZATION: 'authority-transfer-authorization',
  CONTRACT_TEST_BARE: 'contract-test-bare',
} as const;
export const formIdEnum = z.enum(
  Object.values(FORM_ID) as [typeof FORM_ID[keyof typeof FORM_ID], ...typeof FORM_ID[keyof typeof FORM_ID][]]
);
export type FormId = z.infer<typeof formIdEnum>;

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

export const templateManifestSchema = z.object({
  id: formIdEnum,
  name: z.string().trim().min(1, 'Template name is required'),
});
export type TemplateManifest = z.infer<typeof templateManifestSchema>;
export const templateManifestListSchema = z.array(templateManifestSchema);

/**
 * Intra-service contract representing a compliance form template layout and metadata.
 *
 * Used internally by Compliance Service backend APIs and MFE components (such as `TemplateSelector`
 * and `DocumentViewer`) to load, select, and render raw template layouts prior to Handlebars data hydration.
 *
 * @property id - Strict canonical template identifier enum
 * @property name - Display title rendered in selector UI components
 * @property type - Classification type governing workflow processing (`AUTHORIZATION` vs `RECEIPT`)
 * @property rawHTML - Raw Handlebars template string evaluated and rendered within document workspace viewers
 */
export const templateDTOSchema = templateManifestSchema.extend({
  type: formTypeEnum,
  transferType: transferTypeEnum,
  rawHTML: z.string().min(1, 'Raw HTML string is required'),
});
export type TemplateDTO = z.infer<typeof templateDTOSchema>;

export const templateDTOwithPayloadSchema = templateDTOSchema.extend({
  payloadSchema: z.instanceof(z.ZodPipeline),
})
export type TemplateDTOwithPayloadSchema = z.infer<typeof templateDTOwithPayloadSchema>;