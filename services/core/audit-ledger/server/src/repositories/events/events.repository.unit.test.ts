// File: services/core/audit-ledger/server/src/repositories/events/events.repository.unit.test.ts
import type { Db } from 'mongodb';
import { mockFromSchema } from '@shared/testing';
import { eventLogEntitySchema } from '../../domain';
import { EventsRepository } from './events.repository';

vi.mock('../../db', async () => import('../../db/indexes'));

describe('EventsRepository', () => {
  const entry = mockFromSchema(eventLogEntitySchema, { data: { action: 'created' } });
  let insertOne: ReturnType<typeof vi.fn>;
  let collection: ReturnType<typeof vi.fn>;
  let repository: EventsRepository;

  beforeEach(() => {
    insertOne = vi.fn().mockResolvedValue({});
    collection = vi.fn().mockReturnValue({ insertOne });
    repository = new EventsRepository({ collection } as unknown as Db);
  });

  it('inserts a copy of the event into the event log', async () => {
    await repository.append(entry);
    expect(collection).toHaveBeenCalledWith('events');
    expect(insertOne).toHaveBeenCalledOnce();
    expect(insertOne).toHaveBeenCalledWith(entry);
    expect(insertOne.mock.calls[0][0]).not.toBe(entry);
  });

  it('treats duplicate-key errors as harmless redelivery', async () => {
    insertOne.mockRejectedValueOnce({ code: 11000 });
    await expect(repository.append(entry)).resolves.toBeUndefined();
  });

  it('propagates other database failures', async () => {
    const error = new Error('database unavailable');
    insertOne.mockRejectedValueOnce(error);
    await expect(repository.append(entry)).rejects.toBe(error);
  });
});
