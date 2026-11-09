// File: services/core/audit-ledger/server/src/repositories/sealed/sealed.repository.ts
import type { Db } from 'mongodb';
import { sealedTransferSchema, type SealedTransfer } from 'audit-shared';
import { COLLECTIONS } from '../../db';

/** Insert-only: this repository intentionally exposes no update or delete. */
export class SealedTransfersRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection(COLLECTIONS.SEALED);
  }

  /** Throws a duplicate-key error if the sequence or requisition number is already sealed. */
  async insert(record: SealedTransfer): Promise<void> {
    await this.collection.insertOne({ ...record });
  }

  async findLast(): Promise<SealedTransfer | null> {
    const doc = await this.collection.findOne({}, { projection: { _id: 0 }, sort: { sequence: -1 } });
    return doc ? sealedTransferSchema.parse(doc) : null;
  }

  async findByRequisition(requisitionNumber: string): Promise<SealedTransfer | null> {
    const doc = await this.collection.findOne({ requisitionNumber }, { projection: { _id: 0 } });
    return doc ? sealedTransferSchema.parse(doc) : null;
  }

  async list(limit: number, offset: number): Promise<SealedTransfer[]> {
    const docs = await this.collection
      .find({}, { projection: { _id: 0 } })
      .sort({ sequence: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    return docs.map((doc) => sealedTransferSchema.parse(doc));
  }

  async listAfter(sequence: number, limit: number): Promise<SealedTransfer[]> {
    const docs = await this.collection.find({ sequence: { $gt: sequence } }, { projection: { _id: 0 } })
      .sort({ sequence: 1 }).limit(limit).toArray();
    return docs.map((doc) => sealedTransferSchema.parse(doc));
  }

  /** Streams every record in chain order for verification. */
  async *iterateInOrder(): AsyncGenerator<SealedTransfer> {
    const cursor = this.collection.find({}, { projection: { _id: 0 } }).sort({ sequence: 1 });
    for await (const doc of cursor) yield sealedTransferSchema.parse(doc);
  }
}
