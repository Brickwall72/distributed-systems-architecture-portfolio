// File: services/core/topology-service/server/src/database/seed.integration.test.ts
import neo4j, { type Driver } from 'neo4j-driver';
import { randomUUID } from 'node:crypto';
import { TOPOLOGY_SIGNED_EVENT_TYPE } from '@contracts/topology';
import { seedSpaceCustodyGraphTopology } from './seed';
import { TransferClaimsRepository } from '../repositories';

const uri = process.env.SEED_TEST_NEO4J_URI;

describe('fresh topology seed with Neo4j', () => {
  let driver: Driver;

  beforeAll(async () => {
    if (!uri) throw new Error('SEED_TEST_NEO4J_URI must point to an empty isolated database');
    driver = neo4j.driver(uri);
    await driver.verifyConnectivity();
    const session = driver.session();
    try {
      const result = await session.run('MATCH (n) RETURN count(n) AS count');
      if (result.records[0].get('count').toNumber() !== 0) {
        throw new Error('Seed integration test requires an empty database');
      }
    } finally {
      await session.close();
    }
    await seedSpaceCustodyGraphTopology(driver);
  }, 30000);

  afterAll(async () => {
    await driver?.close();
  });

  it('completes the remaining seeded partial receipt and does not restore prior custody on restart', async () => {
    const repository = new TransferClaimsRepository(driver);
    const transferId = '10000000-0000-4000-8000-000000000001';
    const claim = {
      documentId: randomUUID(), draftHash: 'a'.repeat(64), creatorId: 'test',
      templateId: 'asset-transfer-receipt', storageBucket: 'bucket', storageKey: 'draft',
      signerOrgId: 'org-ksc-gov', senderOrgId: 'org-jeb-junkyard', receiverOrgId: 'org-ksc-gov',
      requisitionNumber: 'REQ-KSP-MULTI-001', transferType: 'PHYSICAL_TRANSFER' as const,
      operation: 'RECEIPT' as const, transferEventId: transferId, assetIds: ['asset-heavy-lifter-tanks'],
    };
    await repository.reserveForSigning(claim);
    const result = await repository.commitSigned({
      specversion: '1.0', id: `evt_compliance_signed_${claim.documentId}`, source: 'service:compliance-server',
      type: TOPOLOGY_SIGNED_EVENT_TYPE, time: '2026-01-01T00:00:00.000Z', datacontenttype: 'application/json',
      data: { documentId: claim.documentId, transferEventId: transferId, draftHash: claim.draftHash, signedFileHash: 'b'.repeat(64) },
    });
    expect(result.status).toBe('COMPLETED');

    await seedSpaceCustodyGraphTopology(driver);
    const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (owner:Organization)-[:HAS_CUSTODY]->(asset:Asset {id: 'asset-heavy-lifter-tanks'})
        RETURN collect(owner.id) AS owners, asset.status AS status
      `);
      expect(result.records[0].get('owners')).toEqual(['org-ksc-gov']);
      expect(result.records[0].get('status')).toBe('AVAILABLE');
    } finally {
      await session.close();
    }
  }, 30000);
});
