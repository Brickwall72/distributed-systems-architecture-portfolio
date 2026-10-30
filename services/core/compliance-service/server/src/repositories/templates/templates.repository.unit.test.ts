// File: services/core/compliance-service/server/src/repositories/templates/templates.repository.unit.test.ts
import fs from 'node:fs';
import { templateDTOSchema, templateManifestListSchema } from 'compliance-shared';
import { mockFromSchema } from '@shared/testing';
import { TemplateRepository } from './templates.repository';
import { templatesArray } from '../../registry';

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
  const mockRawHTML = () => mockFromSchema(templateDTOSchema.shape.rawHTML);

  // Registry entries are the source of truth for what the repository may serve
  const [firstTemplate, secondTemplate] = templatesArray;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(mockRawHTML());
  });

  describe('findById', () => {
    it('returns null when queried with an unregistered template ID', () => {
      expect(TemplateRepository.findById('non-existent-template-id' as never)).toBeNull();
    });

    it('loads, parses, and returns the canonical TemplateDTO when found on disk', () => {
      const rawHTML = mockRawHTML();
      mockFs.readFileSync.mockReturnValue(rawHTML);

      const result = TemplateRepository.findById(firstTemplate.id);

      const { fileName: _fileName, ...expectedMeta } = firstTemplate;
      expect(result).toEqual({ ...expectedMeta, rawHTML });
      expect(() => templateDTOSchema.parse(result)).not.toThrow();
    });

    it('serves subsequent queries from memory cache without re-reading disk', () => {
      const firstCall = TemplateRepository.findById(secondTemplate.id);
      const readsAfterFirstCall = mockFs.readFileSync.mock.calls.length;

      const secondCall = TemplateRepository.findById(secondTemplate.id);

      expect(secondCall).toBe(firstCall);
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(readsAfterFirstCall);
    });

    it('throws an explicit operational error when the template file is missing on disk', () => {
      const missing = templatesArray[2];
      mockFs.existsSync.mockImplementation((filePath) => !String(filePath).endsWith(missing.fileName));

      expect(() => TemplateRepository.findById(missing.id)).toThrowError(
        /Compliance template asset missing on disk/
      );
    });
  });

  describe('findAllManifests', () => {
    it('returns id/name manifests for every registered template without loading content', () => {
      const manifests = TemplateRepository.findAllManifests();

      expect(manifests).toEqual(templatesArray.map(({ id, name }) => ({ id, name })));
      expect(templateManifestListSchema.safeParse(manifests).success).toBe(true);
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
      expect(manifests.some((m) => (m.id as string) === 'contract-test-bare')).toBe(false);
    });

    it('filters manifests by type', () => {
      const manifests = TemplateRepository.findAllManifests({ type: firstTemplate.type });

      const expectedIds = templatesArray.filter((t) => t.type === firstTemplate.type).map((t) => t.id);
      expect(manifests.map((m) => m.id)).toEqual(expectedIds);
    });

    it('filters manifests by transferType', () => {
      const manifests = TemplateRepository.findAllManifests({ transferType: firstTemplate.transferType });

      const expectedIds = templatesArray
        .filter((t) => t.transferType === firstTemplate.transferType)
        .map((t) => t.id);
      expect(manifests.map((m) => m.id)).toEqual(expectedIds);
    });

    it('filters manifests by case-insensitive search over name and id', () => {
      const manifests = TemplateRepository.findAllManifests({ search: firstTemplate.name.toUpperCase() });

      expect(manifests.map((m) => m.id)).toContain(firstTemplate.id);
      expect(manifests.every((m) => m.name.toLowerCase().includes(firstTemplate.name.toLowerCase()) || m.id.includes(firstTemplate.name.toLowerCase()))).toBe(true);
    });
  });
});
