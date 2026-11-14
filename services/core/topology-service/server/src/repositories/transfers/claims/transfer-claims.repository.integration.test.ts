// File: services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.integration.test.ts
import { randomUUID } from 'node:crypto';
import neo4j, { type Driver } from 'neo4j-driver';
import { TOPOLOGY_SIGNED_EVENT_TYPE } from '@contracts/topology';
import { TransferClaimConflict, TransferClaimsRepository, TransferDraftRepository, type TransferClaim } from '../index';

const uri = process.env.CLAIM_TEST_NEO4J_URI;

describe('transfer reservations with Neo4j', () => {
  let driver: Driver;
  let repository: TransferClaimsRepository;
  const runId = randomUUID();
  const asset = (name: string) => `${runId}-${name}`;
  const transferId = randomUUID();
  const durableReceiptTransferId = randomUUID();
  const claim = (overrides: Partial<TransferClaim> = {}): TransferClaim => ({
    documentId: randomUUID(), draftHash: 'a'.repeat(64), creatorId: 'creator',
    templateId: 'asset-transfer-authorization', storageBucket: 'bucket', storageKey: 'draft',
    signerOrgId: asset('sender'),
    senderOrgId: asset('sender'), receiverOrgId: asset('receiver'),
    requisitionNumber: asset(randomUUID()), transferType: 'PHYSICAL_TRANSFER',
    operation: 'AUTHORIZATION', assetIds: [asset('available')], ...overrides,
  });

  beforeAll(async () => {
    if (!uri) throw new Error('CLAIM_TEST_NEO4J_URI must point to an isolated test database');
    driver = neo4j.driver(uri);
    await driver.verifyConnectivity();
    const session = driver.session();
    try {
      await session.run('CREATE CONSTRAINT idx_claim_document IF NOT EXISTS FOR (c:TransferClaim) REQUIRE c.documentId IS UNIQUE');
      await session.run('CREATE CONSTRAINT idx_claim_req IF NOT EXISTS FOR (r:TransferClaimRequisition) REQUIRE r.requisitionNumber IS UNIQUE');
      await session.run(`
        CREATE (sender:Organization {id: $sender, name: 'Sender', type: 'CONTRACTOR', testRun: $runId}),
          (receiver:Organization {id: $receiver, name: 'Receiver', type: 'CONTRACTOR', testRun: $runId}),
          (available:Asset {id: $available, status: 'AVAILABLE', controlType: 'LOCAL', testRun: $runId}),
          (another:Asset {id: $another, status: 'AVAILABLE', controlType: 'LOCAL', testRun: $runId}),
          (durable:Asset {id: $durable, status: 'AVAILABLE', controlType: 'LOCAL', testRun: $runId}),
          (remote:Asset {id: $remote, status: 'AVAILABLE', controlType: 'REMOTE', testRun: $runId}),
          (transit:Asset {id: $transit, status: 'IN_TRANSIT', controlType: 'LOCAL', testRun: $runId}),
          (durableTransit:Asset {id: $durableTransit, status: 'IN_TRANSIT', controlType: 'LOCAL', testRun: $runId}),
          (completed:Asset {id: $completed, status: 'AVAILABLE', controlType: 'LOCAL', testRun: $runId}),
          (event:TransferEvent {id: $transferId, requisitionNumber: $req, date: $date, type: 'PHYSICAL_TRANSFER', status: 'PARTIALLY_COMPLETED', testRun: $runId}),
          (durableEvent:TransferEvent {id: $durableTransferId, requisitionNumber: $durableReq, date: $date, type: 'PHYSICAL_TRANSFER', status: 'IN_PROGRESS', testRun: $runId}),
          (sender)-[:HAS_CUSTODY]->(available), (sender)-[:HAS_CUSTODY]->(another), (sender)-[:HAS_CUSTODY]->(durable), (sender)-[:HAS_CUSTODY]->(remote),
          (sender)-[:HAS_CUSTODY]->(transit), (sender)-[:HAS_CUSTODY]->(durableTransit), (receiver)-[:HAS_CUSTODY]->(completed),
          (sender)-[:DELIVERED_FROM]->(event)-[:DELIVERED_TO]->(receiver),
          (sender)-[:DELIVERED_FROM]->(durableEvent)-[:DELIVERED_TO]->(receiver),
          (event)-[:INVOLVES {status: 'IN_TRANSIT'}]->(transit),
          (durableEvent)-[:INVOLVES {status: 'IN_TRANSIT'}]->(durableTransit),
          (event)-[:INVOLVES {status: 'COMPLETED'}]->(completed)
      `, { runId, sender: asset('sender'), receiver: asset('receiver'), available: asset('available'),
        another: asset('another'), durable: asset('durable'), remote: asset('remote'), transit: asset('transit'),
        durableTransit: asset('durable-transit'), completed: asset('completed'), transferId, req: asset('receipt'),
        durableTransferId: durableReceiptTransferId, durableReq: asset('durable-receipt'), date: new Date().toISOString() });
      await session.run(`
        MATCH (a:Asset {testRun: $runId})
        SET a.name = 'Test asset', a.nomenclature = 'Test', a.serialNumber = a.id, a.type = 'Test'
      `, { runId });
    } finally {
      await session.close();
    }
    repository = new TransferClaimsRepository(driver);
  }, 30000);

  afterAll(async () => {
    if (!driver) return;
    const session = driver.session();
    try {
      await session.run(`
        MATCH (n)
        WHERE n.testRun = $runId OR (n:TransferClaim AND n.documentId IN $documentIds)
          OR (n:TransferClaimRequisition AND n.requisitionNumber STARTS WITH $prefix)
          OR (n:TransferEvent AND n.requisitionNumber STARTS WITH $prefix)
        DETACH DELETE n
      `, { runId, prefix: runId, documentIds });
    } finally {
      await session.close();
      await driver.close();
    }
  });
  const documentIds: string[] = [];
  const track = (input: TransferClaim) => { documentIds.push(input.documentId); return input; };
  const signedEvent = (input: TransferClaim, transferEventId: string) => ({
    specversion: '1.0', id: `evt_compliance_signed_${input.documentId}`, source: 'service:compliance-server',
    type: TOPOLOGY_SIGNED_EVENT_TYPE, time: '2026-01-01T00:00:00.000Z', datacontenttype: 'application/json',
    data: { documentId: input.documentId, transferEventId, draftHash: input.draftHash, signedFileHash: 'b'.repeat(64) },
  });
  afterEach(async () => {
    const session = driver.session();
    try {
      await session.run(`
        MATCH (claim:TransferClaim)
        WHERE claim.documentId IN $documentIds AND claim.state = 'SIGNING'
        DETACH DELETE claim
      `, { documentIds });
    } finally {
      await session.close();
    }
  });

  it('validates draft facts from topology and rejects mismatched custody and transfer states', async () => {
    const repository = new TransferDraftRepository(driver);
    const authorization = {
      senderOrgId: asset('sender'), receiverOrgId: asset('receiver'),
      requisitionNumber: asset(randomUUID()), transferType: 'PHYSICAL_TRANSFER' as const,
      operation: 'AUTHORIZATION' as const, assetIds: [asset('available')],
    };
    const facts = await repository.validate(authorization);
    expect(facts.sender).toMatchObject({ id: asset('sender'), name: 'Sender' });
    expect(facts.receiver).toMatchObject({ id: asset('receiver'), name: 'Receiver' });
    expect(facts.assets).toMatchObject([{ id: asset('available'), currentOwnerId: asset('sender'), status: 'AVAILABLE' }]);
    await expect(repository.validate({ ...authorization, assetIds: [asset('remote')] })).rejects.toBeInstanceOf(TransferClaimConflict);
    await expect(repository.validate({ ...authorization, senderOrgId: asset('receiver'), receiverOrgId: asset('sender') }))
      .rejects.toBeInstanceOf(TransferClaimConflict);
    const receipt = {
      ...authorization, operation: 'RECEIPT' as const, transferEventId: transferId,
      requisitionNumber: asset('receipt'), assetIds: [asset('transit')],
    };
    expect((await repository.validate(receipt)).assets[0].status).toBe('IN_TRANSIT');
    await expect(repository.validate({ ...receipt, assetIds: [asset('completed')] })).rejects.toBeInstanceOf(TransferClaimConflict);
  });

  it('serializes competing claims and supports exact retries', async () => {
    const first = track(claim());
    const second = track(claim());
    const results = await Promise.allSettled([repository.reserveForSigning(first), repository.reserveForSigning(second)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const winner = results[0].status === 'fulfilled' ? first : second;
    const successful = results.find((result) => result.status === 'fulfilled');
    if (!successful || successful.status !== 'fulfilled') throw new Error('Expected a successful reservation');
    await expect(repository.reserveForSigning(winner)).resolves.toEqual(successful.value);
    await expect(repository.reserveForSigning({ ...winner, draftHash: 'b'.repeat(64) })).rejects.toBeInstanceOf(TransferClaimConflict);
  });

  it('keeps a durable reservation and transfer ID stable through retries and commit', async () => {
    const first = track(claim({ assetIds: [asset('durable')] }));
    const competitor = track(claim({ assetIds: [asset('durable')] }));

    const reserved = await repository.reserveForSigning(first);
    expect(await repository.reserveForSigning(first)).toEqual(reserved);
    const graph = driver.session();
    try {
      const state = await graph.run(
        'MATCH (c:TransferClaim {documentId: $documentId}) RETURN c.state AS state, c.expiresAt AS expiresAt',
        { documentId: first.documentId },
      );
      expect(state.records[0].get('state')).toBe('SIGNING');
      expect(state.records[0].get('expiresAt')).toBeNull();
    } finally {
      await graph.close();
    }
    await expect(repository.reserveForSigning(competitor)).rejects.toBeInstanceOf(TransferClaimConflict);
    const signed = {
      specversion: '1.0', id: `evt_compliance_signed_${first.documentId}`, source: 'service:compliance-server',
      type: TOPOLOGY_SIGNED_EVENT_TYPE, time: '2026-01-01T00:00:00.000Z',
      datacontenttype: 'application/json',
      data: { documentId: first.documentId, transferEventId: reserved.transferEventId,
        draftHash: first.draftHash, signedFileHash: 'b'.repeat(64) },
    };
    await expect(repository.commitSigned({ ...signed, data: { ...signed.data, transferEventId: randomUUID() } }))
      .rejects.toBeInstanceOf(TransferClaimConflict);
    await expect(repository.commitSigned({ ...signed, data: { ...signed.data, draftHash: 'c'.repeat(64) } }))
      .rejects.toBeInstanceOf(TransferClaimConflict);
    expect(await repository.commitSigned(signed)).toEqual({ transferEventId: reserved.transferEventId, status: 'IN_PROGRESS' });
    expect(await repository.commitSigned(signed)).toEqual({ transferEventId: reserved.transferEventId, status: 'IN_PROGRESS' });
    await expect(repository.commitSigned({ ...signed, data: { ...signed.data, signedFileHash: 'c'.repeat(64) } }))
      .rejects.toBeInstanceOf(TransferClaimConflict);
    expect(await repository.reserveForSigning(first)).toEqual(reserved);
  });

  it('excludes competing durable receipt reservations for the same in-transit asset', async () => {
    const receipt = track(claim({
      operation: 'RECEIPT', signerOrgId: asset('receiver'), transferEventId: durableReceiptTransferId,
      requisitionNumber: asset('durable-receipt'), assetIds: [asset('durable-transit')],
    }));
    const other = track({ ...receipt, documentId: randomUUID() });
    const results = await Promise.allSettled([repository.reserveForSigning(receipt), repository.reserveForSigning(other)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const winner = results[0].status === 'fulfilled' ? receipt : other;
    expect(await repository.reserveForSigning(winner)).toEqual({ transferEventId: durableReceiptTransferId });
    expect(await repository.commitSigned(signedEvent(winner, durableReceiptTransferId))).toEqual({ transferEventId: durableReceiptTransferId, status: 'COMPLETED' });
  });

  it('serializes a requisition even when different assets are requested', async () => {
    const first = track(claim());
    const second = track(claim({ requisitionNumber: first.requisitionNumber, assetIds: [asset('another')] }));
    await repository.reserveForSigning(first);
    await expect(repository.reserveForSigning(second)).rejects.toBeInstanceOf(TransferClaimConflict);
  });

  it('only reserves in-transit assets for the receiver on the matching transfer', async () => {
    const receipt = track(claim({
      operation: 'RECEIPT', signerOrgId: asset('receiver'), transferEventId: transferId,
      requisitionNumber: asset('receipt'), assetIds: [asset('transit')],
    }));
    const invalid = track(claim({ ...receipt, documentId: randomUUID(), assetIds: [asset('completed')] }));
    await expect(repository.reserveForSigning(invalid)).rejects.toBeInstanceOf(TransferClaimConflict);
    await expect(repository.reserveForSigning(receipt)).resolves.toEqual({ transferEventId: transferId });
  });

  it('rejects a transfer whose asset control type does not match the operation', async () => {
    const wrongPhysical = track(claim({ assetIds: [asset('remote')] }));
    const wrongC2 = track(claim({ transferType: 'C2_TRANSFER' }));
    await expect(repository.reserveForSigning(wrongPhysical)).rejects.toBeInstanceOf(TransferClaimConflict);
    await expect(repository.reserveForSigning(wrongC2)).rejects.toBeInstanceOf(TransferClaimConflict);
    await expect(repository.reserveForSigning({ ...claim(), receiverOrgId: asset('sender') })).rejects.toThrow();
  });

  it('never expires a signing claim even if an expiry timestamp is present', async () => {
    const replacement = track(claim());
    await repository.reserveForSigning(replacement);
    const session = driver.session();
    try {
      await session.run(`
        MATCH (claim:TransferClaim {documentId: $id})
        SET claim.expiresAt = datetime() - duration({seconds: 1})
      `, { id: replacement.documentId });
      const competing = track(claim());
      await expect(repository.reserveForSigning(competing)).rejects.toBeInstanceOf(TransferClaimConflict);
    } finally {
      await session.close();
    }
  });

  it('commits an authorization once and accepts identical concurrent retries', async () => {
    const request = track(claim());
    const { transferEventId } = await repository.reserveForSigning(request);
    const event = signedEvent(request, transferEventId);
    const [first, second] = await Promise.all([repository.commitSigned(event), repository.commitSigned(event)]);
    expect(first).toEqual(second);
    expect(first.status).toBe('IN_PROGRESS');
    const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (claim:TransferClaim {documentId: $id})
        RETURN claim.outboxSubject AS subject, claim.outboxPayload AS payload, claim.outboxPublished AS published
      `, { id: request.documentId });
      const row = result.records[0];
      expect(row.get('subject')).toBe('events.topology.transfer.created');
      expect(row.get('published')).toBe(false);
      expect(JSON.parse(row.get('payload'))).toMatchObject({
        id: `evt_topology_${request.documentId}`,
        data: { transferEventId: first.transferEventId, requisitionNumber: request.requisitionNumber },
      });
    } finally {
      await session.close();
    }
  });

  it('rejects a stale reservation without creating a partial transfer', async () => {
    const request = track(claim({ assetIds: [asset('another')] }));
    const { transferEventId } = await repository.reserveForSigning(request);
    const session = driver.session();
    try {
      await session.run(`MATCH (asset:Asset {id: $id}) SET asset.status = 'IN_TRANSIT'`, { id: asset('another') });
      await expect(repository.commitSigned(signedEvent(request, transferEventId))).rejects.toBeInstanceOf(TransferClaimConflict);
      const result = await session.run(`
        OPTIONAL MATCH (event:TransferEvent {requisitionNumber: $req})
        RETURN count(event) AS count
      `, { req: request.requisitionNumber });
      expect(result.records[0].get('count').toNumber()).toBe(0);
      await session.run(`
        MATCH (asset:Asset {id: $id}) SET asset.status = 'AVAILABLE'
      `, { id: asset('another') });
    } finally {
      await session.close();
    }
  });

  it('commits a partial receipt using the original transfer', async () => {
    const receipt = track(claim({
      operation: 'RECEIPT', signerOrgId: asset('receiver'), transferEventId: transferId,
      requisitionNumber: asset('receipt'), assetIds: [asset('transit')],
    }));
    await repository.reserveForSigning(receipt);
    const event = signedEvent(receipt, transferId);
    expect(await repository.commitSigned(event)).toEqual({ transferEventId: transferId, status: 'COMPLETED' });
    expect(await repository.commitSigned(event)).toEqual({ transferEventId: transferId, status: 'COMPLETED' });
  });

  it('serializes concurrent partial receipts so the final transfer status is completed', async () => {
    const eventId = randomUUID();
    const requisitionNumber = asset(randomUUID());
    const firstAsset = asset(randomUUID());
    const secondAsset = asset(randomUUID());
    const session = driver.session();
    try {
      await session.run(`
        MATCH (sender:Organization {id: $sender}), (receiver:Organization {id: $receiver})
        CREATE (event:TransferEvent {id: $eventId, requisitionNumber: $requisitionNumber, date: $date,
          type: 'PHYSICAL_TRANSFER', status: 'IN_PROGRESS', testRun: $runId}),
          (first:Asset {id: $firstAsset, name: 'First', nomenclature: 'Test', serialNumber: '1', type: 'Test', status: 'IN_TRANSIT', controlType: 'LOCAL', testRun: $runId}),
          (second:Asset {id: $secondAsset, name: 'Second', nomenclature: 'Test', serialNumber: '2', type: 'Test', status: 'IN_TRANSIT', controlType: 'LOCAL', testRun: $runId}),
          (sender)-[:DELIVERED_FROM]->(event)-[:DELIVERED_TO]->(receiver),
          (sender)-[:HAS_CUSTODY]->(first), (sender)-[:HAS_CUSTODY]->(second),
          (event)-[:INVOLVES {status: 'IN_TRANSIT'}]->(first),
          (event)-[:INVOLVES {status: 'IN_TRANSIT'}]->(second)
      `, { sender: asset('sender'), receiver: asset('receiver'), eventId, requisitionNumber, firstAsset, secondAsset, runId, date: new Date().toISOString() });
      const first = track(claim({ operation: 'RECEIPT', signerOrgId: asset('receiver'), transferEventId: eventId, requisitionNumber, assetIds: [firstAsset] }));
      const second = track(claim({ operation: 'RECEIPT', signerOrgId: asset('receiver'), transferEventId: eventId, requisitionNumber, assetIds: [secondAsset] }));
      await Promise.all([repository.reserveForSigning(first), repository.reserveForSigning(second)]);
      const results = await Promise.all([repository.commitSigned(signedEvent(first, eventId)), repository.commitSigned(signedEvent(second, eventId))]);
      expect(results.map((result) => result.status).sort()).toEqual(['COMPLETED', 'PARTIALLY_COMPLETED']);
      const current = await session.run('MATCH (e:TransferEvent {id: $eventId}) RETURN e.status AS status', { eventId });
      expect(current.records[0].get('status')).toBe('COMPLETED');
      const outbox = await session.run(`
        MATCH (claim:TransferClaim {transferEventId: $eventId})
        RETURN claim.outboxPayload AS payload
        ORDER BY claim.outboxSequence
      `, { eventId });
      const events = outbox.records.map((record) => JSON.parse(record.get('payload')));
      expect(events.map((event) => event.data.transferEventStatus)).toEqual(['PARTIALLY_COMPLETED', 'COMPLETED']);
      expect(events[0].data.receivedAssets).toHaveLength(1);
      expect(events[1].data.receivedAssets).toHaveLength(1);
      expect(events[0].data.receivedAssets[0].id).not.toBe(events[1].data.receivedAssets[0].id);
    } finally {
      await session.close();
    }
  });

  it('completes C2 transfers and changes custody in the same commit', async () => {
    const request = track(claim({ transferType: 'C2_TRANSFER', assetIds: [asset('remote')] }));
    const { transferEventId } = await repository.reserveForSigning(request);
    const result = await repository.commitSigned(signedEvent(request, transferEventId));
    expect(result.status).toBe('COMPLETED');
    const session = driver.session();
    try {
      const owner = await session.run(`
        MATCH (owner:Organization)-[:HAS_CUSTODY]->(asset:Asset {id: $id})
        RETURN collect(owner.id) AS owners, asset.status AS status
      `, { id: asset('remote') });
      expect(owner.records[0].get('owners')).toEqual([asset('receiver')]);
      expect(owner.records[0].get('status')).toBe('AVAILABLE');
    } finally {
      await session.close();
    }
  });
});
