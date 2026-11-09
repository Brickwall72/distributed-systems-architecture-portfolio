// File: services/core/audit-ledger/server/src/db/indexes.ts
import type { Db } from 'mongodb';

export const COLLECTIONS = {
  EVENTS: 'events',
  DRAFTS: 'drafts',
  SEALED: 'sealed_transfers',
  RENDITIONS: 'transfer_renditions',
  DEAD_LETTERS: 'dead_letters',
} as const;

/** Unique indexes enforce idempotency (eventId) and the chain shape (sequence, requisitionNumber). */
export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTIONS.EVENTS).createIndexes([{ key: { eventId: 1 }, unique: true }]);
  await db.collection(COLLECTIONS.EVENTS).createIndexes([{ key: { requisitionNumber: 1 } }]);
  await db.collection(COLLECTIONS.DRAFTS).createIndexes([{ key: { requisitionNumber: 1 }, unique: true }]);
  await db.collection(COLLECTIONS.SEALED).createIndexes([{ key: { sequence: 1 }, unique: true }]);
  await db.collection(COLLECTIONS.SEALED).createIndexes([{ key: { requisitionNumber: 1 }, unique: true }]);
  await db.collection(COLLECTIONS.RENDITIONS).createIndexes([
    { key: { sequence: 1, kind: 1, templateVersion: 1 }, unique: true },
    { key: { status: 1, nextAttemptAt: 1, leaseUntil: 1 } },
  ]);
  await db.collection(COLLECTIONS.DEAD_LETTERS).createIndexes([{ key: { receivedAt: -1 } }]);
}
