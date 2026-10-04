// File: services/core/compliance-service/server/src/repositories/Templates/Templates.unit.test.ts
import fs from 'node:fs';

describe('TemplateRepository', () => {
  let TemplateRepository: typeof import('./Templates').TemplateRepository;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./Templates');
    TemplateRepository = mod.TemplateRepository;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findById', () => {
    it('returns null for unrecognized template IDs', () => {
      const result = TemplateRepository.findById('unregistered-template-id');
      expect(result).toBeNull();
    });

    it('throws an explicit error when template file is missing on disk', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(() =>
        TemplateRepository.findById('contract-test-bare')
      ).toThrowError(/Compliance template asset missing on disk/);
    });

    it('loads and returns compliance template from disk on initial request', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('<h1>Test HTML Content</h1>');

      const template = TemplateRepository.findById('contract-test-bare');

      expect(template).toEqual({
        id: 'contract-test-bare',
        name: 'Minimal Test Template',
        html: '<h1>Test HTML Content</h1>',
      });
    });

    it('serves template from in-memory cache on subsequent requests without re-reading disk', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('<html>Cached Content</html>');

      const firstCall = TemplateRepository.findById('asset-transfer-authorization');
      const secondCall = TemplateRepository.findById('asset-transfer-authorization');

      expect(firstCall).toBe(secondCall);
      expect(readSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns all active templates while excluding contract-test-bare', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        return `<content>${String(filePath)}</content>`;
      });

      const templates = TemplateRepository.findAll();
      const templateIds = templates.map((t) => t.id);

      expect(templateIds).toContain('asset-transfer-authorization');
      expect(templateIds).toContain('asset-transfer-receipt');
      expect(templateIds).not.toContain('contract-test-bare');
      expect(templates).toHaveLength(2);
    });
  });
});