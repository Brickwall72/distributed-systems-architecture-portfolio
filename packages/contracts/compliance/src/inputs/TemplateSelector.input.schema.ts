import { transferTypeEnum } from '@contracts/common';
import { z } from 'zod';

export const FORM_TYPE = {
  AUTHORIZATION: 'AUTHORIZATION',
  RECEIPT: 'RECEIPT',
} as const;
export const formTypeEnum = z.enum(
  Object.values(FORM_TYPE) as [typeof FORM_TYPE[keyof typeof FORM_TYPE], ...typeof FORM_TYPE[keyof typeof FORM_TYPE][]]
);
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
export const templateManifestSchema = z.object({
  id: formIdEnum,
  name: z.string().trim().min(1, 'Template name is required'),
});
export type TemplateManifest = z.infer<typeof templateManifestSchema>;
export const templateManifestListSchema = z.array(templateManifestSchema);
export const templateDTOSchema = templateManifestSchema.extend({
  type: formTypeEnum,
  transferType: transferTypeEnum,
  rawHTML: z.string().min(1, 'Raw HTML string is required'),
});
export type TemplateDTO = z.infer<typeof templateDTOSchema>;

export const templateDTOwithPayloadSchema = templateDTOSchema.extend({
  payloadSchema: z.instanceof(z.ZodPipeline),
})
export type TemplateDTOwithPayload = z.infer<typeof templateDTOwithPayloadSchema>;
export const GetTemplatesQuerySchema = z.object({
  type: formTypeEnum.optional(),
  transferType: transferTypeEnum.optional(),
  search: z.string().trim().min(1).optional(),
});
export const templateSelectorPropsInputSchema = z.object({
  label: z.string().optional(),
  typeFilter: formTypeEnum.optional(),
  transferTypeFilter: transferTypeEnum.optional(),
})
export type TemplateSelectorPropsInput = z.input<typeof templateSelectorPropsInputSchema> & { readonly onSelect: (template: TemplateDTOwithPayload | undefined) => void };