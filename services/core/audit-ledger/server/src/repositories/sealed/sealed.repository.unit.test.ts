// File: services/core/audit-ledger/server/src/repositories/sealed/sealed.repository.unit.test.ts
import type { Db } from 'mongodb';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { sealedTransferSchema } from 'audit-shared';
import { SealedTransfersRepository } from './sealed.repository';

vi.mock('../../db', async () => import('../../db/indexes'));

describe('SealedTransfersRepository', () => {
  const record = mockFromSchema(sealedTransferSchema, {
    sequence: 1, requisitionNumber: 'REQ-1', prevHash: SHA256_HEX, recordHash: SHA256_HEX,
  });
  const second = { ...record, sequence: 2, requisitionNumber: 'REQ-2' };
  let insertOne: ReturnType<typeof vi.fn>;
  let findOne: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let sort: ReturnType<typeof vi.fn>;
  let skip: ReturnType<typeof vi.fn>;
  let limit: ReturnType<typeof vi.fn>;
  let toArray: ReturnType<typeof vi.fn>;
  let collection: ReturnType<typeof vi.fn>;
  let streamed: unknown[];
  let repository: SealedTransfersRepository;

  beforeEach(() => {
    insertOne = vi.fn().mockResolvedValue({});
    findOne = vi.fn().mockResolvedValue(record);
    toArray = vi.fn().mockResolvedValue([record]);
    limit = vi.fn().mockReturnValue({ toArray });
    skip = vi.fn().mockReturnValue({ limit });
    streamed = [record, second];
    sort = vi.fn().mockReturnValue({
      skip, limit,
      async *[Symbol.asyncIterator]() {
        for (const doc of streamed) yield doc;
      },
    });
    find = vi.fn().mockReturnValue({ sort });
    collection = vi.fn().mockReturnValue({ insertOne, findOne, find });
    repository = new SealedTransfersRepository({ collection } as unknown as Db);
  });

  it('inserts a copy and propagates duplicate-key failures', async () => {
    await repository.insert(record);
    expect(collection).toHaveBeenCalledWith('sealed_transfers');
    expect(insertOne).toHaveBeenCalledWith(record);
    expect(insertOne.mock.calls[0][0]).not.toBe(record);
    const error = { code: 11000 };
    insertOne.mockRejectedValueOnce(error);
    await expect(repository.insert(record)).rejects.toBe(error);
  });

  it('finds the last record by descending sequence', async () => {
    expect(await repository.findLast()).toEqual(record);
    expect(findOne).toHaveBeenCalledWith({}, { projection: { _id: 0 }, sort: { sequence: -1 } });
    findOne.mockResolvedValueOnce(null);
    expect(await repository.findLast()).toBeNull();
  });

  it('finds a sealed record by requisition or returns null', async () => {
    expect(await repository.findByRequisition('REQ-1')).toEqual(record);
    expect(findOne).toHaveBeenCalledWith({ requisitionNumber: 'REQ-1' }, { projection: { _id: 0 } });
    findOne.mockResolvedValueOnce(null);
    expect(await repository.findByRequisition('missing')).toBeNull();
  });

  it('lists records in descending order with offset and limit', async () => {
    expect(await repository.list(10, 20)).toEqual([record]);
    expect(find).toHaveBeenCalledWith({}, { projection: { _id: 0 } });
    expect(sort).toHaveBeenCalledWith({ sequence: -1 });
    expect(skip).toHaveBeenCalledWith(20);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('uses ascending keyset pagination for reconciliation', async () => {
    toArray.mockResolvedValueOnce([second]);
    expect(await repository.listAfter(1, 25)).toEqual([second]);
    expect(find).toHaveBeenCalledWith({ sequence: { $gt: 1 } }, { projection: { _id: 0 } });
    expect(sort).toHaveBeenCalledWith({ sequence: 1 });
    expect(limit).toHaveBeenCalledWith(25);
    expect(skip).not.toHaveBeenCalled();
  });

  it('streams records in ascending chain order', async () => {
    const records = [];
    for await (const item of repository.iterateInOrder()) records.push(item);
    expect(records).toEqual([record, second]);
    expect(find).toHaveBeenCalledWith({}, { projection: { _id: 0 } });
    expect(sort).toHaveBeenCalledWith({ sequence: 1 });
  });

  it('rejects invalid stored records on reads and streams', async () => {
    const invalid = { ...record, sequence: 0 };
    findOne.mockResolvedValueOnce(invalid);
    await expect(repository.findLast()).rejects.toThrow();
    toArray.mockResolvedValueOnce([invalid]);
    await expect(repository.listAfter(0, 10)).rejects.toThrow();
    streamed = [invalid];
    await expect(repository.iterateInOrder().next()).rejects.toThrow();
  });

  it('propagates read failures', async () => {
    const error = new Error('database unavailable');
    findOne.mockRejectedValueOnce(error);
    await expect(repository.findByRequisition('REQ-1')).rejects.toBe(error);
    toArray.mockRejectedValueOnce(error);
    await expect(repository.list(10, 0)).rejects.toBe(error);
  });
});
