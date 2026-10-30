// File: services/core/compliance-service/server/src/repositories/templates/templates.repository.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FormId,
  TemplateDTO,
  templateDTOSchema,
  templateManifestListSchema,
  GetTemplatesQuery,
} from 'compliance-shared';
import { masterTemplateRegistry, templatesArray } from '../../registry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getTemplateDirectory = (): string => {
  const candidatePaths = [
    path.resolve(__dirname, '../../registry/templates'),
    path.resolve(__dirname, '../../../src/registry/templates'),
    path.resolve(process.cwd(), 'dist/registry/templates'),
    path.resolve(process.cwd(), 'src/registry/templates'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(__dirname, '../../registry/templates');
};

const TEMPLATES_DIR = getTemplateDirectory();
const templateCache = new Map<string, TemplateDTO>();

export const TemplateRepository = {
  findById: (id: FormId) => {
    if (!(id in masterTemplateRegistry)) {
      return null;
    }

    if (templateCache.has(id)) {
      return templateCache.get(id)!;
    }

    const meta = masterTemplateRegistry[id];
    const filePath = path.join(TEMPLATES_DIR, meta.fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Compliance template asset missing on disk: ${filePath}`);
    }

    const rawHTML = fs.readFileSync(filePath, 'utf-8');
    const template = templateDTOSchema.parse({
      ...meta,
      rawHTML,
    });

    templateCache.set(id, template);
    return template;
  },

  findAllManifests: (query?: GetTemplatesQuery) => {
    let templates = templatesArray.filter((meta) => meta.id !== 'contract-test-bare');

    if (query?.type) {
      templates = templates.filter((t) => t.type === query.type);
    }

    if (query?.transferType) {
      templates = templates.filter((t) => t.transferType === query.transferType);
    }

    if (query?.search) {
      const searchLower = query.search.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.id.toLowerCase().includes(searchLower)
      );
    }

    return templateManifestListSchema.parse(templates);
  },
};