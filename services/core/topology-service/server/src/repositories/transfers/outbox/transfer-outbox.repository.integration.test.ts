// File: services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.integration.test.ts
import { randomUUID } from 'node:crypto';
import neo4j, { type Driver } from 'neo4j-driver';
import { TransferOutboxRepository } from './transfer-outbox.repository';

const uri = process.env.CLAIM_TEST_NEO4J_URI;

describe('transfer outbox with Neo4j', () => {
  const transferEventId = randomUUID();
  const firstId = randomUUID();
  const secondId = randomUUID();
  let driver: Driver;
  let repository: TransferOutboxRepository;

  beforeAll(async () => {
    if (!uri) throw new Error('CLAIM_TEST_NEO4J_URI must point to an isolated test database');
    driver = neo4j.driver(uri);
    await driver.verifyConnectivity();
    repository = new TransferOutboxRepository(driver);
    const event = (documentId: string) => ({
      specversion: '1.0', id: `evt_${documentId}`, source: 'service:topology-server',
      type: 'com.system.topology.transfer.updated', time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        transferEventId, requisitionNumber: 'test-req', transferEventStatus: 'PARTIALLY_COMPLETED',
        documentId, receivedAssets: [{
          id: 'asset', name: 'Asset', nomenclature: 'Test', serialNumber: '1',
          type: 'Test', status: 'AVAILABLE', controlType: 'LOCAL', currentOwnerId: 'receiver',
        }],
      },
    });
    const session = driver.session();
    try {
      await session.run(`
        CREATE (:TransferEvent {id: $transferEventId}),
          (:TransferClaim {documentId: $firstId, state: 'COMMITTED', transferEventId: $transferEventId,
            outboxSequence: 1, outboxPublished: false, outboxSubject: 'events.topology.transfer.updated', outboxPayload: $firstPayload}),
          (:TransferClaim {documentId: $secondId, state: 'COMMITTED', transferEventId: $transferEventId,
            outboxSequence: 2, outboxPublished: false, outboxSubject: 'events.topology.transfer.updated', outboxPayload: $secondPayload})
      `, { transferEventId, firstId, secondId, firstPayload: JSON.stringify(event(firstId)), secondPayload: JSON.stringify(event(secondId)) });
    } finally {
      await session.close();
    }
  }, 30000);

  afterAll(async () => {
    if (!driver) return;
    const session = driver.session();
    try {
      await session.run(`
        MATCH (n) WHERE (n:TransferClaim AND n.documentId IN $ids) OR (n:TransferEvent AND n.id = $transferEventId)
        DETACH DELETE n
      `, { ids: [firstId, secondId], transferEventId });
    } finally {
      await session.close();
      await driver.close();
    }
  });

  it('leases one event at a time, preserves transfer order, and redelivers with the same event id', async () => {
    const claims = await Promise.all([repository.claimNext(), repository.claimNext()]);
    const first = claims.find((item) => item !== null);
    expect(claims.filter((item) => item !== null)).toHaveLength(1);
    expect(first?.documentId).toBe(firstId);
    expect(await repository.claimNext()).toBeNull();
    if (!first) throw new Error('Expected the first outbox event');

    const session = driver.session();
    try {
      await session.run(`
        MATCH (claim:TransferClaim {documentId: $id})
        SET claim.outboxLeaseUntil = datetime() - duration({seconds: 1})
      `, { id: firstId });
    } finally {
      await session.close();
    }
    const retry = await repository.claimNext();
    expect(retry?.event.id).toBe(first.event.id);
    if (!retry) throw new Error('Expected a retry');
    await expect(repository.markPublished(first)).rejects.toThrow('lease was lost');
    await repository.markPublished(retry);

    const second = await repository.claimNext();
    expect(second?.documentId).toBe(secondId);
    if (!second) throw new Error('Expected the second outbox event');
    await repository.markPublished(second);
    expect(await repository.claimNext()).toBeNull();
  });
});
