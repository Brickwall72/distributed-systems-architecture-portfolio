// File: services/core/audit-ledger/server/src/repositories/drafts/drafts.repository.unit.test.ts
import type { Db } from 'mongodb';
import { mockFromSchema } from '@shared/testing';
import { LEDGER_STATUS } from 'audit-shared';
import { transferDraftEntitySchema } from '../../domain';
import { DraftsRepository } from './drafts.repository';

vi.mock('../../db', async () => import('../../db/indexes'));

describe('DraftsRepository', () => {
  const now = '2026-01-02T03:04:05.000Z';
  const draft = mockFromSchema(transferDraftEntitySchema, {
    requisitionNumber: 'REQ-1', status: LEDGER_STATUS.OPEN, receiptDocuments: {}, receivedAssets: {},
  });
  let findOne: ReturnType<typeof vi.fn>;
  let updateOne: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let sort: ReturnType<typeof vi.fn>;
  let skip: ReturnType<typeof vi.fn>;
  let limit: ReturnType<typeof vi.fn>;
  let toArray: ReturnType<typeof vi.fn>;
  let collection: ReturnType<typeof vi.fn>;
  let repository: DraftsRepository;

  beforeEach(() => {
    findOne = vi.fn().mockResolvedValue(draft);
    updateOne = vi.fn().mockResolvedValue({ matchedCount: 1, upsertedCount: 0 });
    toArray = vi.fn().mockResolvedValue([draft]);
    limit = vi.fn().mockReturnValue({ toArray });
    skip = vi.fn().mockReturnValue({ limit });
    sort = vi.fn().mockReturnValue({ skip });
    find = vi.fn().mockReturnValue({ sort });
    collection = vi.fn().mockReturnValue({ findOne, updateOne, find });
    repository = new DraftsRepository({ collection } as unknown as Db);
  });

  it('finds and validates a draft by requisition, or returns null', async () => {
    expect(await repository.findByRequisition('REQ-1')).toEqual(draft);
    expect(collection).toHaveBeenCalledWith('drafts');
    expect(findOne).toHaveBeenCalledWith({ requisitionNumber: 'REQ-1' }, { projection: { _id: 0 } });
    findOne.mockResolvedValueOnce(null);
    expect(await repository.findByRequisition('missing')).toBeNull();
    findOne.mockResolvedValueOnce({ ...draft, createdAt: 'invalid' });
    await expect(repository.findByRequisition('REQ-1')).rejects.toThrow();
  });

  it.each([
    [{ matchedCount: 1, upsertedCount: 0 }, 'APPLIED'],
    [{ matchedCount: 0, upsertedCount: 1 }, 'APPLIED'],
    [{ matchedCount: 0, upsertedCount: 0 }, 'ALREADY_SEALED'],
  ] as const)('merges event fields and returns %s as %s', async (result, outcome) => {
    updateOne.mockResolvedValueOnce(result);
    const fields = { 'receivedAssets.doc-1': [{ id: 'asset-1' }], updatedAt: 'ignored' };
    expect(await repository.apply('REQ-1', fields, 'event-1', now)).toBe(outcome);
    expect(updateOne).toHaveBeenCalledWith(
      { requisitionNumber: 'REQ-1', status: { $ne: LEDGER_STATUS.SEALED } },
      {
        $set: { ...fields, updatedAt: now },
        $addToSet: { eventIds: 'event-1' },
        $setOnInsert: { status: LEDGER_STATUS.OPEN, createdAt: now },
      },
      { upsert: true },
    );
  });

  it('recognizes a sealed draft after a duplicate-key upsert', async () => {
    updateOne.mockRejectedValueOnce({ code: 11000 });
    findOne.mockResolvedValueOnce({ ...draft, status: LEDGER_STATUS.SEALED });
    expect(await repository.apply('REQ-1', {}, 'event-1', now)).toBe('ALREADY_SEALED');
    expect(updateOne).toHaveBeenCalledOnce();
  });

  it('accepts a known event redelivered after the transfer was sealed', async () => {
    updateOne.mockRejectedValueOnce({ code: 11000 });
    findOne.mockResolvedValueOnce({ ...draft, status: LEDGER_STATUS.SEALED, eventIds: ['event-1'] });
    expect(await repository.apply('REQ-1', {}, 'event-1', now)).toBe('APPLIED');
  });

  it.each([draft, null])('retries an upsert race when the existing draft is %s', async (existing) => {
    updateOne.mockRejectedValueOnce({ code: 11000 }).mockResolvedValueOnce({ matchedCount: 1, upsertedCount: 0 });
    findOne.mockResolvedValueOnce(existing);
    expect(await repository.apply('REQ-1', {}, 'event-1', now)).toBe('APPLIED');
    expect(updateOne).toHaveBeenCalledTimes(2);
    expect(updateOne.mock.calls[0]).toEqual(updateOne.mock.calls[1]);
  });

  it('fails explicitly after two duplicate-key races', async () => {
    updateOne.mockRejectedValue({ code: 11000 });
    await expect(repository.apply('REQ-1', {}, 'event-1', now)).rejects.toThrow('Unable to apply event to draft REQ-1');
    expect(updateOne).toHaveBeenCalledTimes(2);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('propagates database failures during apply and duplicate-key lookup', async () => {
    const error = new Error('database unavailable');
    updateOne.mockRejectedValueOnce(error);
    await expect(repository.apply('REQ-1', {}, 'event-1', now)).rejects.toBe(error);
    updateOne.mockRejectedValueOnce({ code: 11000 });
    findOne.mockRejectedValueOnce(error);
    await expect(repository.apply('REQ-1', {}, 'event-1', now)).rejects.toBe(error);
  });

  it('marks a draft sealed with the given timestamp', async () => {
    await repository.markSealed('REQ-1', now);
    expect(updateOne).toHaveBeenCalledWith(
      { requisitionNumber: 'REQ-1' },
      { $set: { status: LEDGER_STATUS.SEALED, updatedAt: now } },
    );
  });

  it.each([undefined, LEDGER_STATUS.OPEN])('lists validated drafts with status %s and pagination', async (status) => {
    expect(await repository.list(status, 10, 20, { kind: 'auditor' })).toEqual([draft]);
    expect(find).toHaveBeenCalledWith(status ? { status } : {}, { projection: { _id: 0 } });
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
    expect(skip).toHaveBeenCalledWith(20);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('filters by participation before pagination', async () => {
    await repository.list(LEDGER_STATUS.OPEN, 10, 20, { kind: 'organization', orgId: 'org-a' });
    expect(find).toHaveBeenCalledWith({
      status: LEDGER_STATUS.OPEN,
      'sender.id': { $type: 'string', $ne: '' },
      'receiver.id': { $type: 'string', $ne: '' },
      $or: [{ 'sender.id': 'org-a' }, { 'receiver.id': 'org-a' }],
    }, { projection: { _id: 0 } });
  });

  it('rejects invalid stored drafts and propagates query failures', async () => {
    toArray.mockResolvedValueOnce([{ ...draft, status: 'invalid' }]);
    await expect(repository.list(undefined, 10, 0, { kind: 'auditor' })).rejects.toThrow();
    const error = new Error('database unavailable');
    toArray.mockRejectedValueOnce(error);
    await expect(repository.list(undefined, 10, 0, { kind: 'auditor' })).rejects.toBe(error);
    updateOne.mockRejectedValueOnce(error);
    await expect(repository.markSealed('REQ-1', now)).rejects.toBe(error);
  });
});
