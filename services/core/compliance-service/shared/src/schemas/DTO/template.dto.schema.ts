// File: services/core/compliance-service/shared/src/schemas/DTO/template.dto.schema.ts
import { z } from 'zod';

// ==========================================
//    COMPLIANCE INTRA-SERVICE TEMPLATE CONTRACT
// ==========================================

/**
 * Canonical template identifier enum governing valid system forms.
 */
export const TemplateIdSchema = z.enum([
  'asset-transfer-authorization',
  'asset-transfer-receipt',
  'contract-test-bare',
]);

export type TemplateId = z.infer<typeof TemplateIdSchema>;

/**
 * Domain classification enum for official compliance templates.
 */
export const TemplateTypeSchema = z.enum([
  'AUTHORIZATION',
  'RECEIPT',
]);

export type TemplateType = z.infer<typeof TemplateTypeSchema>;

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
export const TemplateDTOSchema = z.object({
  id: TemplateIdSchema,
  name: z.string().trim().min(1, 'Template name is required'),
  type: TemplateTypeSchema,
  rawHTML: z.string().min(1, 'Raw HTML string is required'),
});

export type TemplateDTO = z.infer<typeof TemplateDTOSchema>;