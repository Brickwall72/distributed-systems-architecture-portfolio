// File: services/core/audit-ledger/server/src/registry/render-overview.ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hydrateTemplate } from '@shared/utils';
import type { TransferOverviewInput } from './overview.schema';

export function renderTransferOverview(data: TransferOverviewInput): string {
  const built = resolve(process.cwd(), 'dist/registry/templates/transfer-overview.hbs');
  const source = resolve(process.cwd(), 'src/registry/templates/transfer-overview.hbs');
  const template = readFileSync(existsSync(source) ? source : built, 'utf8');
  return hydrateTemplate(template, data);
}
