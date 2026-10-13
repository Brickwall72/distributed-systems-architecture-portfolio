// File: services/platform/compliance/client/src/registry/generateTemplatePayload.unit.test.ts
import { generateTemplatePayload } from './generateTemplatePayload';

describe('generateTemplatePayload', () => {
  it('resolves asset-transfer-authorization using the authorization parser', () => {
    const result = generateTemplatePayload({
      templateId: 'asset-transfer-authorization', 
      input: { requisitionNumber: 'REQ-AUTH-001', },
      usePlaceholders: false
    });

    expect(result.requisitionNumber).toBe('REQ-AUTH-001');
    expect(result).toHaveProperty('authorizingEntityName');
  });

  it('resolves asset-transfer-receipt using the receipt parser', () => {
    const result = generateTemplatePayload({
      templateId: 'asset-transfer-receipt', 
      input: { requisitionNumber: 'REQ-REC-001',}, 
      usePlaceholders: false
    });

    expect(result.requisitionNumber).toBe('REQ-REC-001');
    expect(result).toHaveProperty('transferringEntityName');
  });

  it('resolves contract-test-bare using the inline handler', () => {
    const result = generateTemplatePayload({
      templateId: 'contract-test-bare',
      input: {},
      usePlaceholders: true
    });

    expect(result.requisitionNumber).toBe('[TEST-REQ]');
    expect(result.items).toEqual([]);
  });

  it('falls back gracefully when an unknown template ID is provided', () => {
    const result = generateTemplatePayload({
      templateId: 'non-existent-template' as any,
      input: {},
      usePlaceholders: true
    });

    expect(result.requisitionNumber).toBe('[REQ-PENDING]');
    expect(result.items).toEqual([]);
  });
});