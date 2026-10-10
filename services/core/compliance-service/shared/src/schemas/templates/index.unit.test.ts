// File: services/core/compliance-service/shared/src/schemas/templates/index.unit.test.ts
import { TemplateIdSchema } from './index';

describe('TemplateIdSchema', () => {
  it('accepts valid template identifier enum values', () => {
    const validIds = [
      'asset-transfer-authorization',
      'asset-transfer-receipt',
      'contract-test-bare',
    ];

    for (const id of validIds) {
      const result = TemplateIdSchema.safeParse(id);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid or obsolete template identifiers', () => {
    const invalidIds = [
      'transfer-authorization',
      'TRANSFER-RECEIPT',
      'unknown-template',
      '',
    ];

    for (const id of invalidIds) {
      const result = TemplateIdSchema.safeParse(id);
      expect(result.success).toBe(false);
    }
  });
});