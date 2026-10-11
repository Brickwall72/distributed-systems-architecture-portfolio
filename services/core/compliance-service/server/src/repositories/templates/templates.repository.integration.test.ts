// File: services/core/compliance-service/server/src/repositories/templates/templates.repository.integration.ts
import { TemplateRepository } from './templates.repository';

describe('TemplateRepository', () => {
  it('retrieves all public template manifests, excluding test-bare templates', () => {
    const manifests = TemplateRepository.findAllManifests();
    
    expect(manifests.length).toBeGreaterThan(0);
    // Ensure internal contract-test-bare is excluded
    expect(manifests.some((m) => m.id === 'contract-test-bare')).toBe(false);
  });

  it('filters manifests by template type query', () => {
    const authorizationManifests = TemplateRepository.findAllManifests({ type: 'AUTHORIZATION' });
    
    expect(authorizationManifests.length).toBeGreaterThan(0);
    authorizationManifests.forEach((m) => {
      expect(m.type).toBe('AUTHORIZATION');
    });
  });

  it('filters manifests by search query', () => {
    const searchResults = TemplateRepository.findAllManifests({ search: 'Asset Transfer' });
    
    expect(searchResults.length).toBeGreaterThan(0);
    searchResults.forEach((m) => {
      const matchesNameOrId = 
        m.name.toLowerCase().includes('asset transfer') || 
        m.id.toLowerCase().includes('asset transfer');
      expect(matchesNameOrId).toBe(true);
    });
  });

  it('retrieves a complete template DTO including raw HTML by ID', () => {
    const template = TemplateRepository.findById('asset-transfer-authorization');
    
    expect(template).not.toBeNull();
    expect(template).toEqual(
      expect.objectContaining({
        id: 'asset-transfer-authorization',
        name: 'Asset Transfer Authorization',
        type: 'AUTHORIZATION',
        rawHTML: expect.any(String),
      })
    );
    expect(template?.rawHTML.length).toBeGreaterThan(0);
  });

  it('returns null for non-existent template IDs', () => {
    const template = TemplateRepository.findById('non-existent-template-id');
    expect(template).toBeNull();
  });
});