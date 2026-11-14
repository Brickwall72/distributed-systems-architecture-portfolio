// File: services/core/audit-ledger/server/src/repositories/dead-letters/dead-letters.repository.ts
import type { Db } from 'mongodb';
import { deadLetterSchema, type DeadLetter } from 'audit-shared';
import { COLLECTIONS } from '../../db/indexes';

export class DeadLettersRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection(COLLECTIONS.DEAD_LETTERS);
  }

  async add(entry: DeadLetter): Promise<void> {
    await this.collection.insertOne({ ...entry });
  }

  async list(limit = 200): Promise<DeadLetter[]> {
    const docs = await this.collection
      .find({}, { projection: { _id: 0 } })
      .sort({ receivedAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map((doc) => deadLetterSchema.parse(doc));
  }
}
