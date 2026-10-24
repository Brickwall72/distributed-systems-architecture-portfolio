// File: services/core/compliance-service/shared/src/schemas/DTO/template.dto.schema.ts
import { z } from 'zod';
import { transferTypeEnum } from '@contracts/common';

// ==========================================
//    COMPLIANCE INTRA-SERVICE TEMPLATE CONTRACT
// ==========================================

/**
 * Canonical template identifier enum governing valid system forms.
 */
export const formNameEnum = z.enum([
  'asset-transfer-authorization',
  'asset-transfer-receipt',
  'contract-test-bare',
]);

export type FormName = z.infer<typeof formNameEnum>;

/**
 * Domain classification enum for official compliance templates.
 */
export const formTypeEnum = z.enum(['AUTHORIZATION', 'RECEIPT']);

export type FormType = z.infer<typeof formTypeEnum>;

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
  id: formNameEnum,
  name: z.string().trim().min(1, 'Template name is required'),
  type: formTypeEnum,
  transferType: transferTypeEnum,
  rawHTML: z.string().min(1, 'Raw HTML string is required'),
});

export type TemplateDTO = z.infer<typeof TemplateDTOSchema>;