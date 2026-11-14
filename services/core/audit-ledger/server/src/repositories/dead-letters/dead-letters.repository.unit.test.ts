// File: services/core/audit-ledger/server/src/repositories/dead-letters/dead-letters.repository.unit.test.ts
import type { Db } from 'mongodb';
import { mockFromSchema } from '@shared/testing';
import { deadLetterSchema } from 'audit-shared';
import { DeadLettersRepository } from './dead-letters.repository';

vi.mock('../../db', async () => import('../../db'));

describe('DeadLettersRepository', () => {
  const entry = mockFromSchema(deadLetterSchema, { payload: { event: 'invalid' } });
  let insertOne: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let sort: ReturnType<typeof vi.fn>;
  let limit: ReturnType<typeof vi.fn>;
  let toArray: ReturnType<typeof vi.fn>;
  let collection: ReturnType<typeof vi.fn>;
  let repository: DeadLettersRepository;

  beforeEach(() => {
    insertOne = vi.fn().mockResolvedValue({});
    toArray = vi.fn().mockResolvedValue([entry]);
    limit = vi.fn().mockReturnValue({ toArray });
    sort = vi.fn().mockReturnValue({ limit });
    find = vi.fn().mockReturnValue({ sort });
    collection = vi.fn().mockReturnValue({ insertOne, find });
    repository = new DeadLettersRepository({ collection } as unknown as Db);
  });

  it('inserts a copy of the dead letter', async () => {
    await repository.add(entry);
    expect(collection).toHaveBeenCalledWith('dead_letters');
    expect(insertOne).toHaveBeenCalledWith(entry);
    expect(insertOne.mock.calls[0][0]).not.toBe(entry);
  });

  it.each([undefined, 12])('lists the newest entries with limit %s', async (requestedLimit) => {
    expect(await repository.list(requestedLimit)).toEqual([entry]);
    expect(collection).toHaveBeenCalledWith('dead_letters');
    expect(find).toHaveBeenCalledWith({}, { projection: { _id: 0 } });
    expect(sort).toHaveBeenCalledWith({ receivedAt: -1 });
    expect(limit).toHaveBeenCalledWith(requestedLimit ?? 200);
  });

  it('rejects invalid stored documents rather than returning them', async () => {
    toArray.mockResolvedValueOnce([{ ...entry, receivedAt: 'invalid' }]);
    await expect(repository.list()).rejects.toThrow();
  });

  it('propagates insert and query failures', async () => {
    const error = new Error('database unavailable');
    insertOne.mockRejectedValueOnce(error);
    await expect(repository.add(entry)).rejects.toBe(error);
    toArray.mockRejectedValueOnce(error);
    await expect(repository.list()).rejects.toBe(error);
  });
});
