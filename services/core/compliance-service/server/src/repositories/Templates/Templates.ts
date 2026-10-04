// File: services/core/compliance-service/server/src/repositories/Templates/Templates.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ComplianceTemplate {
  id: string;
  name: string;
  html: string;
}

interface TemplateMetadata {
  name: string;
  fileName: string;
}

const TEMPLATE_METADATA: Record<string, TemplateMetadata> = {
  'transfer-authorization': {
    name: 'Asset Transfer Authorization',
    fileName: 'transfer-authorization.hbs',
  },
  'dd-1149': {
    name: 'DD Form 1149 (Requisition & Invoice)',
    fileName: 'dd-1149.hbs',
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
  const distPath = path.join(__dirname, '../../assets/templates');
  if (fs.existsSync(distPath)) return distPath;

  const srcPath = path.join(__dirname, '../../../src/assets/templates');
  if (fs.existsSync(srcPath)) return srcPath;

  return distPath;
};

const TEMPLATES_DIR = getTemplateDirectory();
const templateCache = new Map<string, ComplianceTemplate>();

export const TemplateRepository = {
  findById: (id: string): ComplianceTemplate | null => {
    if (!(id in TEMPLATE_METADATA)) {
      return null;
    }

    if (templateCache.has(id)) {
      return templateCache.get(id)!;
    }

    const meta = TEMPLATE_METADATA[id];
    const filePath = path.join(TEMPLATES_DIR, meta.fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Compliance template asset missing on disk: ${filePath}`);
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const template: ComplianceTemplate = { id, name: meta.name, html };

    templateCache.set(id, template);
    return template;
  },

  findAll: (): ComplianceTemplate[] => {
    return Object.keys(TEMPLATE_METADATA)
      .map((id) => TemplateRepository.findById(id))
      .filter((template): template is ComplianceTemplate => template !== null);
  },
};