// File: services/core/audit-ledger/server/src/repositories/renditions/renditions.repository.unit.test.ts
import type { Db } from 'mongodb';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { RenditionsRepository, renditionSchema } from './renditions.repository';

describe('RenditionsRepository', () => {
  const now = new Date('2025-01-01T00:00:00.000Z');
  const job = mockFromSchema(renditionSchema, {
    sequence: 1, sourceRecordHash: SHA256_HEX, status: 'GENERATING',
    claimToken: 'claim-1', attempts: 2, leaseUntil: new Date(now.getTime() + 60_000),
  });
  let updateOne: ReturnType<typeof vi.fn>;
  let findOneAndUpdate: ReturnType<typeof vi.fn>;
  let repo: RenditionsRepository;
  beforeEach(() => {
    updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    findOneAndUpdate = vi.fn().mockImplementation((_filter, update) =>
      Promise.resolve({ ...job, claimToken: update.$set.claimToken, leaseUntil: update.$set.leaseUntil }));
    const db = { collection: vi.fn().mockReturnValue({ updateOne, findOneAndUpdate }) };
    repo = new RenditionsRepository(db as unknown as Db);
  });

  it('ensures a unique job and tolerates a concurrent upsert', async () => {
    updateOne.mockRejectedValueOnce({ code: 11000 });
    await expect(repo.ensure({ sequence: 1, requisitionNumber: 'REQ', recordHash: SHA256_HEX })).resolves.toBeUndefined();
    expect(updateOne).toHaveBeenCalledWith(
      { sequence: 1, kind: 'TRANSFER_OVERVIEW', templateVersion: '1' },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ status: 'PENDING', attempts: 0 }) }),
      { upsert: true },
    );
    updateOne.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(repo.ensure({ sequence: 1, requisitionNumber: 'REQ', recordHash: SHA256_HEX })).rejects.toThrow('database unavailable');
  });

  it('atomically claims due or expired jobs with distinct tokens', async () => {
    const first = await repo.claim(now, 60_000);
    const second = await repo.claim(now, 60_000);
    expect(first?.claimToken).not.toEqual(second?.claimToken);
    expect(findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'TRANSFER_OVERVIEW', templateVersion: '1',
      $or: [
        { status: { $in: ['PENDING', 'FAILED'] }, nextAttemptAt: { $lte: now } },
        { status: 'GENERATING', leaseUntil: { $lte: now } },
      ],
    }), expect.objectContaining({ $inc: { attempts: 1 } }), expect.objectContaining({ returnDocument: 'after' }));
  });

  it('fences late completion and failure and computes retry delay', async () => {
    updateOne.mockResolvedValueOnce({ modifiedCount: 0 }).mockResolvedValueOnce({ modifiedCount: 1 });
    expect(await repo.complete(job, { storageBucket: 'dsap', storageKey: 'key', fileHash: SHA256_HEX }, now)).toBe(false);
    expect(await repo.fail(job, 'Error', now)).toBe(true);
    expect(updateOne).toHaveBeenNthCalledWith(1, expect.objectContaining({
      claimToken: 'claim-1', leaseUntil: { $gt: now }, status: 'GENERATING',
    }), expect.anything());
    expect(updateOne).toHaveBeenNthCalledWith(2, expect.objectContaining({
      claimToken: 'claim-1', leaseUntil: { $gt: now },
    }), expect.objectContaining({
      $set: expect.objectContaining({ status: 'FAILED', nextAttemptAt: new Date(now.getTime() + 10_000) }),
    }));
  });
});
