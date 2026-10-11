// File: services/core/compliance-service/server/src/repositories/templates/templates.repository.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TemplateId,
  TemplateDTO,
  TemplateType,
  TemplateManifest,
  GetTemplatesQuery,
} from 'compliance-shared';

interface TemplateMetadata {
  name: string;
  fileName: string;
  type: TemplateType;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getTemplateDirectory = (): string => {
  const candidatePaths = [
    path.resolve(__dirname, './assets/templates'),
    path.resolve(__dirname, '../../assets/templates'),
    path.resolve(__dirname, '../../../src/assets/templates'),
    path.resolve(process.cwd(), 'dist/assets/templates'),
    path.resolve(process.cwd(), 'src/assets/templates'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(__dirname, './assets/templates');
};

const TEMPLATES_DIR = getTemplateDirectory();

// Load metadata from the JSON config alongside the assets
const loadMetadata = (): Record<TemplateId, TemplateMetadata> => {
  const metadataPath = path.join(TEMPLATES_DIR, 'templates.json');
  if (fs.existsSync(metadataPath)) {
    const rawData = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(rawData) as Record<TemplateId, TemplateMetadata>;
  }
  return {} as Record<TemplateId, TemplateMetadata>;
};

const templateCache = new Map<string, TemplateDTO>();

export const TemplateRepository = {
  findById: (id: string): TemplateDTO | null => {
    const metadata = loadMetadata();
    if (!Object.prototype.hasOwnProperty.call(metadata, id)) {
      return null;
    }
    const templateId = id as TemplateId;

    if (templateCache.has(templateId)) {
      return templateCache.get(templateId)!;
    }

    const meta = metadata[templateId];
    const filePath = path.join(TEMPLATES_DIR, meta.fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Compliance template asset missing on disk: ${filePath}`);
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const template: TemplateDTO = {
      id: templateId,
      name: meta.name,
      type: meta.type,
      rawHTML: html,
    };

    templateCache.set(templateId, template);
    return template;
  },

  findAllManifests: (query?: GetTemplatesQuery): TemplateManifest[] => {
    const metadata = loadMetadata();
    
    let manifests: TemplateManifest[] = Object.keys(metadata)
      .filter((id) => id !== 'contract-test-bare')
      .map((id) => {
        const meta = metadata[id as TemplateId];
        return {
          id,
          name: meta.name,
          type: meta.type,
        };
      });

    if (!query) {
      return manifests;
    }

    if (query.type) {
      manifests = manifests.filter((m) => m.type === query.type);
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      manifests = manifests.filter(
        (m) =>
          m.name.toLowerCase().includes(searchLower) ||
          m.id.toLowerCase().includes(searchLower)
      );
    }

    return manifests;
  },
};