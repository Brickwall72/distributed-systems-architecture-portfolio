// File: services/core/audit-ledger/server/src/repositories/events/events.repository.ts
import type { Db } from 'mongodb';
import { COLLECTIONS } from '../../db/indexes';
import type { EventLogEntity } from '../../domain';
import { isDuplicateKeyError } from '../mongo-errors';

/** Insert-only log of every event applied; the unique eventId makes redelivery harmless. */
export class EventsRepository {
  constructor(private readonly db: Db) {}

  async append(entry: EventLogEntity): Promise<void> {
    try {
      await this.db.collection(COLLECTIONS.EVENTS).insertOne({ ...entry });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
}
