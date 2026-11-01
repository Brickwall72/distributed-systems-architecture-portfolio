import { getReceiptTemplateId, FORM_ID } from 'compliance-shared';
import { ComplianceWorkflowWidgetPropsSchema } from '@contracts/compliance';

describe('getReceiptTemplateId', () => {
  it('maps the asset transfer authorization to the asset transfer receipt', () => {
    expect(getReceiptTemplateId(FORM_ID.ASSET_TRANSFER_AUTHORIZATION)).toBe(FORM_ID.ASSET_TRANSFER_RECEIPT);
  });

  it('returns undefined for unmapped or missing authorizing templates', () => {
    expect(getReceiptTemplateId(FORM_ID.AUTHORITY_TRANSFER_AUTHORIZATION)).toBeUndefined();
    expect(getReceiptTemplateId(undefined)).toBeUndefined();
  });
});

describe('ComplianceWorkflowWidgetPropsSchema requisitionNumber/authorizingTemplateId pairing', () => {
  it('accepts all three together or none', () => {
    expect(ComplianceWorkflowWidgetPropsSchema.safeParse({}).success).toBe(true);
    expect(
      ComplianceWorkflowWidgetPropsSchema.safeParse({
        requisitionNumber: 'REQ-1',
        authorizingTemplateId: FORM_ID.ASSET_TRANSFER_AUTHORIZATION,
        transferEventId: '123e4567-e89b-42d3-a456-426614174000',
      }).success
    ).toBe(true);
  });

  it('rejects a partial set', () => {
    expect(
      ComplianceWorkflowWidgetPropsSchema.safeParse({
        requisitionNumber: 'REQ-1',
        authorizingTemplateId: FORM_ID.ASSET_TRANSFER_AUTHORIZATION,
      }).success
    ).toBe(false);
    expect(ComplianceWorkflowWidgetPropsSchema.safeParse({ requisitionNumber: 'REQ-1' }).success).toBe(false);
    expect(
      ComplianceWorkflowWidgetPropsSchema.safeParse({ authorizingTemplateId: FORM_ID.ASSET_TRANSFER_AUTHORIZATION }).success
    ).toBe(false);
  });
});
