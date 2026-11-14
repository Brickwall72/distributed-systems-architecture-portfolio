// File: services/core/compliance-service/server/src/routes/templates/draft.schema.unit.test.ts
import { draftInputSchema, draftPreparationSchema } from './draft.schema';

describe('draft schemas', () => {
  it('requires organizations and at least one asset', () => {
    expect(draftInputSchema.safeParse({
      sourceOrg: { id: 'sender' }, targetOrg: { id: 'receiver' }, assets: [{ id: 'asset' }],
    }).success).toBe(true);
    expect(draftInputSchema.safeParse({
      sourceOrg: { id: 'sender' }, targetOrg: { id: 'receiver' }, assets: [],
    }).success).toBe(false);
    expect(draftInputSchema.safeParse({
      sourceOrg: { id: '' }, targetOrg: { id: 'receiver' }, assets: [{ id: 'asset' }],
    }).success).toBe(false);
  });

  it('distinguishes prepared data from explicit failures', () => {
    expect(draftPreparationSchema.safeParse({
      success: true, requisitionNumber: 'REQ', hydrationData: {}, sourceOrgId: 'sender',
      targetOrgId: 'receiver', assetIds: ['asset'],
    }).success).toBe(true);
    expect(draftPreparationSchema.safeParse({
      success: false, status: 409, body: { error: 'Conflict', code: 'CONFLICT', timestamp: 'now' },
    }).success).toBe(true);
    expect(draftPreparationSchema.safeParse({
      success: false, status: 200, body: { error: 'Conflict', code: 'CONFLICT', timestamp: 'now' },
    }).success).toBe(false);
  });
});
