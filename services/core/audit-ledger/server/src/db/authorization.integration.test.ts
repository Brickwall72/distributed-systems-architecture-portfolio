// File: services/core/audit-ledger/server/src/db/authorization.integration.test.ts
import { MongoClient, type Db } from 'mongodb';
import { ensureIndexes } from './indexes';
import { DraftsRepository } from '../repositories/drafts/drafts.repository';
import { RenditionsRepository } from '../repositories/renditions/renditions.repository';

describe('audit runtime MongoDB authorization', () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    const uri = process.env.AUDIT_TEST_MONGO_URI;
    if (!uri) throw new Error('AUDIT_TEST_MONGO_URI must point to an isolated audit database');
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('audit');
    await ensureIndexes(db, { immutableIndexesProvisioned: true });
  });

  afterAll(async () => {
    await client?.close();
  });

  it('initializes indexes and permits draft and rendition workflows', async () => {
    const drafts = new DraftsRepository(db);
    expect(await drafts.apply('AUTH-TEST', { senderOrgId: 'org-1' }, 'event-1', new Date().toISOString())).toBe('APPLIED');
    await drafts.markSealed('AUTH-TEST', new Date().toISOString());

    const renditions = new RenditionsRepository(db);
    await renditions.ensure({ sequence: 123, requisitionNumber: 'AUTH-TEST', recordHash: 'a'.repeat(64) });
    const now = new Date(Date.now() + 1000);
    const claim = await renditions.claim(now, 60_000);
    expect(claim).not.toBeNull();
    if (!claim) throw new Error('Rendition was not claimed');
    expect(await renditions.complete(claim, {
      storageBucket: 'dsap', storageKey: 'audit/transfers/test.pdf', fileHash: 'b'.repeat(64),
    }, now)).toBe(true);
  });

  it('refuses changes to sealed records and events', async () => {
    for (const name of ['events', 'sealed_transfers']) {
      const collection = db.collection(name);
      await expect(collection.updateOne({}, { $set: { changed: true } })).rejects.toMatchObject({ code: 13 });
      await expect(collection.deleteOne({})).rejects.toMatchObject({ code: 13 });
    }
  });
});
