// File: services/core/audit-ledger/server/src/repositories/mongo-errors.ts
/** MongoDB reports unique-index violations as error code 11000. */
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}
