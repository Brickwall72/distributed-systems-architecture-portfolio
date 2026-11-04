// File: services/core/audit-ledger/server/src/utils/hash.ts
import { createHash } from 'node:crypto';
import type { SealedTransfer } from 'audit-shared';

/** prevHash of the first sealed record. */
export const GENESIS_HASH = '0'.repeat(64);

/** JSON with recursively sorted keys so the same data always serializes to the same bytes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    })
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

export function computeRecordHash(record: Omit<SealedTransfer, 'recordHash'>): string {
  return createHash('sha256').update(canonicalJson(record)).digest('hex');
}
