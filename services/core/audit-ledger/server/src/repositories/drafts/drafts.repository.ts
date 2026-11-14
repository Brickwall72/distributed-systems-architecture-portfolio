// File: services/core/audit-ledger/server/src/repositories/drafts/drafts.repository.ts
import type { Db } from 'mongodb';
import { LEDGER_STATUS, type LedgerStatus } from 'audit-shared';
import { COLLECTIONS } from '../../db/indexes';
import { transferDraftEntitySchema, type TransferDraftEntity } from '../../domain';
import { isDuplicateKeyError } from '../mongo-errors';
import { participantFilter, type AccessScope } from '../access-scope';

export type DraftApplyOutcome = 'APPLIED' | 'ALREADY_SEALED';

export class DraftsRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection(COLLECTIONS.DRAFTS);
  }

  async findByRequisition(requisitionNumber: string): Promise<TransferDraftEntity | null> {
    const doc = await this.collection.findOne({ requisitionNumber }, { projection: { _id: 0 } });
    return doc ? transferDraftEntitySchema.parse(doc) : null;
  }

  /**
   * Idempotent merge: every write is a $set of fixed paths plus $addToSet of the event id,
   * so replaying an event leaves the draft unchanged and concurrent events cannot overwrite each other.
   */
  async apply(
    requisitionNumber: string,
    fields: Record<string, unknown>,
    eventId: string,
    now: string
  ): Promise<DraftApplyOutcome> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await this.collection.updateOne(
          { requisitionNumber, status: { $ne: LEDGER_STATUS.SEALED } },
          {
            $set: { ...fields, updatedAt: now },
            $addToSet: { eventIds: eventId },
            $setOnInsert: { status: LEDGER_STATUS.OPEN, createdAt: now },
          },
          { upsert: true }
        );
        return result.matchedCount + result.upsertedCount > 0 ? 'APPLIED' : 'ALREADY_SEALED';
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
        // Either a sealed draft blocked the upsert, or two upserts raced; the next pass tells them apart.
        const existing = await this.findByRequisition(requisitionNumber);
        if (existing?.status === LEDGER_STATUS.SEALED) {
          return existing.eventIds.includes(eventId) ? 'APPLIED' : 'ALREADY_SEALED';
        }
      }
    }
    throw new Error(`Unable to apply event to draft ${requisitionNumber}`);
  }

  async markSealed(requisitionNumber: string, now: string): Promise<void> {
    await this.collection.updateOne(
      { requisitionNumber },
      { $set: { status: LEDGER_STATUS.SEALED, updatedAt: now } }
    );
  }

  async list(status: LedgerStatus | undefined, limit: number, offset: number, scope: AccessScope): Promise<TransferDraftEntity[]> {
    const docs = await this.collection
      .find({ ...(status ? { status } : {}), ...participantFilter(scope) }, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    return docs.map((doc) => transferDraftEntitySchema.parse(doc));
  }
}
