// File: services/core/compliance-service/server/src/repositories/TemplateRepository.unit.test.ts
import { TemplateRepository } from './TemplateRepository.js';

describe('TemplateRepository', () => {
  it('returns all registered templates via findAll', () => {
    const templates = TemplateRepository.findAll();
    expect(templates.length).toBeGreaterThanOrEqual(2);
    expect(templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dd-1149' }),
        expect.objectContaining({ id: 'contract-test-bare' }),
      ])
    );
  });

  it('finds an existing template by its ID', () => {
    const template = TemplateRepository.findById('contract-test-bare');
    expect(template).not.toBeNull();
    expect(template?.name).toBe('Minimal Test Template');
    expect(template?.html).toContain('Minimal Contract Template');
  });

  it('returns null when searching for a non-existent template ID', () => {
    const template = TemplateRepository.findById('invalid-template-id');
    expect(template).toBeNull();
  });
});