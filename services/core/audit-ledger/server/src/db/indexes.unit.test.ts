// File: services/core/audit-ledger/server/src/db/indexes.unit.test.ts
import type { Db } from 'mongodb';
import { ensureIndexes } from './indexes';

function database(eventIndexes: object[]) {
  const indexes: Record<string, object[]> = {
    events: eventIndexes,
    sealed_transfers: [{ key: { sequence: 1 }, unique: true }, { key: { requisitionNumber: 1 }, unique: true }],
    dead_letters: [{ key: { receivedAt: -1 } }],
  };
  const createIndexes = vi.fn().mockResolvedValue([]);
  const db = {
    collection: (name: string) => ({
      listIndexes: () => ({ toArray: async () => indexes[name] }),
      createIndexes,
    }),
  } as unknown as Db;
  return { db, createIndexes };
}

describe('admin-provisioned audit indexes', () => {
  it('verifies append-only indexes and creates only mutable collection indexes', async () => {
    const { db, createIndexes } = database([
      { key: { eventId: 1 }, unique: true }, { key: { requisitionNumber: 1 } },
    ]);
    await ensureIndexes(db, { immutableIndexesProvisioned: true });
    expect(createIndexes).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ key: { eventId: 1 }, unique: true }],
    [{ key: { eventId: 1 }, unique: true, partialFilterExpression: { eventId: { $exists: true } } }, { key: { requisitionNumber: 1 } }],
    [{ key: { eventId: 1 }, unique: true }, { key: { requisitionNumber: 1 } }, { key: { createdAt: 1 }, expireAfterSeconds: 30 }],
  ])('rejects missing, partial, and TTL indexes', async (...indexes) => {
    await expect(ensureIndexes(database(indexes).db, { immutableIndexesProvisioned: true })).rejects.toThrow();
  });
});
