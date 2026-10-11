// File: services/core/compliance-service/server/src/repositories/templates/templates.repository.unit.test.ts
import fs from 'node:fs';
import { TemplateRepository } from './templates.repository';

// Mock node:fs to control file existence and reading without depending on disk state
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
    },
  };
});

describe('TemplateRepository', () => {
  const mockFs = vi.mocked(fs);

  const mockTemplatesJson = JSON.stringify({
    'asset-transfer-authorization': {
      name: 'Asset Transfer Authorization',
      fileName: 'transfer-authorization.hbs',
      type: 'AUTHORIZATION',
    },
    'asset-transfer-receipt': {
      name: 'Asset Transfer Receipt',
      fileName: 'transfer-receipt.hbs',
      type: 'RECEIPT',
    },
    'contract-test-bare': {
      name: 'Minimal Test Template',
      fileName: 'contract-test-bare.hbs',
      type: 'AUTHORIZATION',
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock behavior: templates.json always exists and returns metadata JSON
    mockFs.existsSync.mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.endsWith('templates.json')) {
        return true;
      }
      return true;
    });

    mockFs.readFileSync.mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.endsWith('templates.json')) {
        return mockTemplatesJson;
      }
      return '<h1>Default Template HTML</h1>';
    });
  });

  describe('findById', () => {
    it('returns null when queried with an unregistered template ID', () => {
      const result = TemplateRepository.findById('non-existent-template-id');

      expect(result).toBeNull();
    });

    it('loads, parses, and returns the canonical TemplateDTO when found on disk', () => {
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.endsWith('templates.json')) {
          return mockTemplatesJson;
        }
        return '<h1>Asset Transfer Authorization</h1>';
      });

      const result = TemplateRepository.findById('asset-transfer-authorization');

      expect(result).toEqual({
        id: 'asset-transfer-authorization',
        name: 'Asset Transfer Authorization',
        type: 'AUTHORIZATION',
        rawHTML: '<h1>Asset Transfer Authorization</h1>',
      });
    });

    it('serves subsequent queries from memory cache without re-reading disk', () => {
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.endsWith('templates.json')) {
          return mockTemplatesJson;
        }
        return '<DOCTYPE html><html><body><h1>Minimal Contract Template</h1></body></html>';
      });

      // First read fills cache
      const firstCall = TemplateRepository.findById('contract-test-bare');
      expect(firstCall?.rawHTML).toContain('Minimal Contract Template');

      // Second read should use cache
      const secondCall = TemplateRepository.findById('contract-test-bare');
      expect(secondCall).toBe(firstCall);
    });

    it('throws an explicit operational error when the template file is missing on disk', () => {
      mockFs.existsSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.endsWith('templates.json')) {
          return true;
        }
        if (typeof filePath === 'string' && filePath.endsWith('transfer-receipt.hbs')) {
          return false;
        }
        return true;
      });

      expect(() => TemplateRepository.findById('asset-transfer-receipt')).toThrowError(
        /Compliance template asset missing on disk/
      );
    });
  });

  describe('findAllManifests', () => {
    it('returns a list of available manifests while excluding test-only fixtures', () => {
      const manifests = TemplateRepository.findAllManifests();

      expect(manifests).toEqual([
        {
          id: 'asset-transfer-authorization',
          name: 'Asset Transfer Authorization',
          type: 'AUTHORIZATION',
        },
        {
          id: 'asset-transfer-receipt',
          name: 'Asset Transfer Receipt',
          type: 'RECEIPT',
        },
      ]);

      // Ensure contract-test-bare is filtered out from UI selection lists
      const hasBareTestContract = manifests.some((m) => m.id === 'contract-test-bare');
      expect(hasBareTestContract).toBe(false);
    });
  });
});