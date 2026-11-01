import { FORM_ID, type FormId } from '../DTO/template.dto.schema';

/**
 * Maps an authorizing template to the receipt template used when receiving its transfer.
 * Resolved at runtime so receipt templates can change without stale data in persisted documents.
 */
export const authorizationToReceiptTemplate: Partial<Record<FormId, FormId>> = {
  [FORM_ID.ASSET_TRANSFER_AUTHORIZATION]: FORM_ID.ASSET_TRANSFER_RECEIPT,
};

export function getReceiptTemplateId(authorizingTemplateId: FormId | undefined): FormId | undefined {
  return authorizingTemplateId ? authorizationToReceiptTemplate[authorizingTemplateId] : undefined;
}
