// File: services/core/audit-ledger/server/src/repositories/renditions/renditions.repository.ts
import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { z } from 'zod';
import { COLLECTIONS } from '../../db/indexes';
import { isDuplicateKeyError } from '../mongo-errors';

export const RENDITION_KIND = 'TRANSFER_OVERVIEW';
export const TEMPLATE_VERSION = '1';

export const renditionSchema = z.object({
  sequence: z.number().int().positive(),
  requisitionNumber: z.string(),
  sourceRecordHash: z.string().length(64),
  kind: z.literal(RENDITION_KIND),
  templateVersion: z.literal(TEMPLATE_VERSION),
  status: z.enum(['PENDING', 'GENERATING', 'READY', 'FAILED']),
  attempts: z.number().int().nonnegative(),
  nextAttemptAt: z.date(),
  leaseUntil: z.date().optional(),
  claimToken: z.string().optional(),
  storageBucket: z.string().optional(),
  storageKey: z.string().optional(),
  fileHash: z.string().optional(),
  generatedAt: z.date().optional(),
  lastError: z.string().optional(),
});
export type Rendition = z.infer<typeof renditionSchema>;

export class RenditionsRepository {
  constructor(private readonly db: Db) {}
  private get collection() { return this.db.collection(COLLECTIONS.RENDITIONS); }

  async ensure(record: { sequence: number; requisitionNumber: string; recordHash: string }): Promise<void> {
    try {
      await this.collection.updateOne(
      { sequence: record.sequence, kind: RENDITION_KIND, templateVersion: TEMPLATE_VERSION },
      { $setOnInsert: {
        sequence: record.sequence, requisitionNumber: record.requisitionNumber,
        sourceRecordHash: record.recordHash, kind: RENDITION_KIND, templateVersion: TEMPLATE_VERSION,
        status: 'PENDING', attempts: 0, nextAttemptAt: new Date(),
      } },
      { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  async claim(now: Date, leaseMs: number): Promise<Rendition | null> {
    const result = await this.collection.findOneAndUpdate(
      { kind: RENDITION_KIND, templateVersion: TEMPLATE_VERSION, $or: [
        { status: { $in: ['PENDING', 'FAILED'] }, nextAttemptAt: { $lte: now } },
        { status: 'GENERATING', leaseUntil: { $lte: now } },
      ] },
      { $set: { status: 'GENERATING', claimToken: randomUUID(), leaseUntil: new Date(now.getTime() + leaseMs) }, $inc: { attempts: 1 } },
      { sort: { nextAttemptAt: 1, sequence: 1 }, returnDocument: 'after', projection: { _id: 0 } },
    );
    if (!result) return null;
    const job = renditionSchema.parse(result);
    if (!job.claimToken || !job.leaseUntil) throw new Error('Claimed rendition is missing its lease or token');
    return job;
  }

  async complete(job: Rendition, artifact: { storageBucket: string; storageKey: string; fileHash: string }, now: Date): Promise<boolean> {
    const result = await this.collection.updateOne(
      { sequence: job.sequence, kind: job.kind, templateVersion: job.templateVersion, status: 'GENERATING', claimToken: job.claimToken, leaseUntil: { $gt: now } },
      { $set: { ...artifact, status: 'READY', generatedAt: now }, $unset: { claimToken: '', leaseUntil: '', lastError: '' } },
    );
    return result.modifiedCount === 1;
  }

  async fail(job: Rendition, message: string, now: Date): Promise<boolean> {
    const delay = Math.min(300_000, 5_000 * 2 ** Math.min(job.attempts - 1, 6));
    const result = await this.collection.updateOne(
      { sequence: job.sequence, kind: job.kind, templateVersion: job.templateVersion, status: 'GENERATING', claimToken: job.claimToken, leaseUntil: { $gt: now } },
      { $set: { status: 'FAILED', lastError: message, nextAttemptAt: new Date(now.getTime() + delay) }, $unset: { claimToken: '', leaseUntil: '' } },
    );
    return result.modifiedCount === 1;
  }

  async findBySequences(sequences: number[]): Promise<Rendition[]> {
    if (!sequences.length) return [];
    const docs = await this.collection.find(
      { sequence: { $in: sequences }, kind: RENDITION_KIND, templateVersion: TEMPLATE_VERSION },
      { projection: { _id: 0 } },
    ).toArray();
    return docs.map((doc) => renditionSchema.parse(doc));
  }
}
