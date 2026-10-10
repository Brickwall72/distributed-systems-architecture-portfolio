// File: services/core/compliance-service/shared/src/schemas/DTO/template.dto.schema.ts
import { z } from 'zod';

// ==========================================
//    COMPLIANCE INTRA-SERVICE TEMPLATE CONTRACT
// ==========================================

/**
 * Domain classification enum for official compliance templates.
 */
export const TemplateTypeSchema = z.enum([
  'AUTHORIZATION',
  'RECEIPT',
]);

/**
 * Intra-service contract representing a compliance form template layout and metadata.
 *
 * Used internally by Compliance Service backend APIs and MFE components (such as `TemplateSelector`
 * and `DocumentViewer`) to load, select, and render raw template layouts prior to Handlebars data hydration.
 *
 * @property id - Unique functional identifier for the template (e.g., 'asset-transfer-authorization')
 * @property name - Display title rendered in selector UI components (e.g., 'Asset Transfer Authorization')
 * @property type - Classification type governing workflow processing (`AUTHORIZATION` vs `RECEIPT`)
 * @property rawHTML - Raw Handlebars template string evaluated and rendered within document workspace viewers
 */
export const TemplateDTOSchema = z.object({
  id: z.string().trim().min(1, 'Template ID is required'),
  name: z.string().trim().min(1, 'Template name is required'),
  type: TemplateTypeSchema,
  rawHTML: z.string().min(1, 'Raw HTML string is required'),
});

export type TemplateDTO = z.infer<typeof TemplateDTOSchema>;
export type TemplateType = z.infer<typeof TemplateTypeSchema>;