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
export async function ensureIndexes(db: Db, options: { immutableIndexesProvisioned?: boolean } = {}): Promise<void> {
  const immutable: Array<{ name: string; indexes: Array<{ key: Record<string, 1 | -1>; unique?: boolean }> }> = [
    { name: COLLECTIONS.EVENTS, indexes: [{ key: { eventId: 1 }, unique: true }, { key: { requisitionNumber: 1 } }] },
    { name: COLLECTIONS.SEALED, indexes: [{ key: { sequence: 1 }, unique: true }, { key: { requisitionNumber: 1 }, unique: true }] },
    { name: COLLECTIONS.DEAD_LETTERS, indexes: [{ key: { receivedAt: -1 } }] },
  ];
  await Promise.all(immutable.map(async ({ name, indexes }) => {
    const collection = db.collection(name);
    if (!options.immutableIndexesProvisioned) {
      await collection.createIndexes(indexes);
      return;
    }
    const existing = await collection.listIndexes().toArray();
    if (existing.some((index) => index.expireAfterSeconds !== undefined)) {
      throw new Error(`MongoDB collection ${name} has a TTL index`);
    }
    for (const expected of indexes) {
      if (!existing.some((index) => JSON.stringify(index.key) === JSON.stringify(expected.key)
        && Boolean(index.unique) === Boolean(expected.unique)
        && !index.sparse && !index.partialFilterExpression && !index.collation)) {
        throw new Error(`MongoDB collection ${name} is missing a required index`);
      }
    }
  }));
  await db.collection(COLLECTIONS.DRAFTS).createIndexes([{ key: { requisitionNumber: 1 }, unique: true }]);
  await db.collection(COLLECTIONS.RENDITIONS).createIndexes([
    { key: { sequence: 1, kind: 1, templateVersion: 1 }, unique: true },
    { key: { status: 1, nextAttemptAt: 1, leaseUntil: 1 } },
  ]);
}
