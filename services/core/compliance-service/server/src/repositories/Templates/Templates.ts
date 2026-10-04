// File: services/core/compliance-service/server/src/repositories/Templates/Templates.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TemplateId } from '@compliance/shared';

export interface ComplianceTemplate {
  id: TemplateId;
  name: string;
  html: string;
}

interface TemplateMetadata {
  name: string;
  fileName: string;
}

const TEMPLATE_METADATA: Record<TemplateId, TemplateMetadata> = {
  'asset-transfer-authorization': {
    name: 'Asset Transfer Authorization',
    fileName: 'transfer-authorization.hbs',
  },
  'asset-transfer-receipt': {
    name: 'Asset Transfer Receipt',
    fileName: 'transfer-receipt.hbs',
  },
  'contract-test-bare': {
    name: 'Minimal Test Template',
    fileName: 'contract-test-bare.hbs',
  },
};

// Node ESM __dirname resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback path resolution checking dist/ and src/ for local test runners
const getTemplateDirectory = (): string => {
  const candidatePaths = [
    // Bundled production build (dist/server.js -> dist/assets/templates)
    path.resolve(__dirname, './assets/templates'),
    // Unbundled dist execution (if tsup preserves folder hierarchy)
    path.resolve(__dirname, '../../assets/templates'),
    // Unbundled source execution (tsx watch / vitest under src/repositories/Templates)
    path.resolve(__dirname, '../../../src/assets/templates'),
    // Execution working directory fallbacks
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
const templateCache = new Map<string, ComplianceTemplate>();

export const TemplateRepository = {
  findById: (id: string): ComplianceTemplate | null => {
    if (!Object.prototype.hasOwnProperty.call(TEMPLATE_METADATA, id)) {
      return null;
    }
    const templateId = id as TemplateId;

    if (templateCache.has(templateId)) {
      return templateCache.get(templateId)!;
    }

    const meta = TEMPLATE_METADATA[templateId];
    const filePath = path.join(TEMPLATES_DIR, meta.fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Compliance template asset missing on disk: ${filePath}`);
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const template: ComplianceTemplate = { id: templateId, name: meta.name, html };

    templateCache.set(templateId, template);
    return template;
  },

  findAll: (): ComplianceTemplate[] => {
    return Object.keys(TEMPLATE_METADATA)
      .filter((id) => id !== 'contract-test-bare')
      .map((id) => TemplateRepository.findById(id))
      .filter((template): template is ComplianceTemplate => template !== null);
  },
};