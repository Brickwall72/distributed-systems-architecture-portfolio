// File: services/core/topology-service/server/src/messaging/transfer-requests.integration.test.ts
// @vitest-environment node
import { randomUUID } from 'node:crypto';
import neo4j from 'neo4j-driver';
import { EventBroker } from '@shared/messaging';
import {
  TOPOLOGY_REQUEST_SUBJECTS, reserveTransferResponseSchema, validateDraftResponseSchema,
} from '@contracts/topology';
import { TransferClaimsRepository, TransferDraftRepository } from '../repositories/transfers';
import { registerTransferRequestResponders } from './transfer-requests.responder';

describe('NATS topology transfer requests', () => {
  it('routes each request to one responder and returns a stable, exclusive reservation', async () => {
    const graphUrl = process.env.CLAIM_TEST_NEO4J_URI;
    const natsUrl = process.env.SIGNING_TEST_NATS_URL;
    if (!graphUrl || !natsUrl) throw new Error('Isolated Neo4j and NATS URLs are required');
    const driver = neo4j.driver(graphUrl);
    const brokers = [new EventBroker(natsUrl), new EventBroker(natsUrl), new EventBroker(natsUrl)];
    const runId = randomUUID();
    const senderOrgId = `sender-${runId}`;
    const receiverOrgId = `receiver-${runId}`;
    const assetId = `asset-${runId}`;
    const claim = {
      documentId: randomUUID(), draftHash: 'a'.repeat(64), creatorId: 'creator',
      templateId: 'asset-transfer-authorization', storageBucket: 'bucket', storageKey: 'draft',
      signerOrgId: senderOrgId, senderOrgId, receiverOrgId, requisitionNumber: `req-${runId}`,
      transferType: 'PHYSICAL_TRANSFER' as const, operation: 'AUTHORIZATION' as const, assetIds: [assetId],
    };
    const graph = driver.session();
    try {
      await graph.run(`
        CREATE CONSTRAINT idx_claim_document IF NOT EXISTS FOR (c:TransferClaim) REQUIRE c.documentId IS UNIQUE
      `);
      await graph.run(`
        CREATE CONSTRAINT idx_claim_req IF NOT EXISTS FOR (r:TransferClaimRequisition) REQUIRE r.requisitionNumber IS UNIQUE
      `);
      await graph.run(`
        CREATE (sender:Organization {id: $senderOrgId, name: 'Sender', type: 'CONTRACTOR', testRun: $runId}),
          (:Organization {id: $receiverOrgId, name: 'Receiver', type: 'CONTRACTOR', testRun: $runId}),
          (asset:Asset {id: $assetId, name: 'Asset', nomenclature: 'Asset', serialNumber: 'SN',
            type: 'Test', controlType: 'LOCAL', status: 'AVAILABLE', testRun: $runId}),
          (sender)-[:HAS_CUSTODY]->(asset)
      `, { senderOrgId, receiverOrgId, assetId, runId });
      await Promise.all(brokers.map((broker) => broker.connect()));
      const claims = new TransferClaimsRepository(driver);
      const drafts = new TransferDraftRepository(driver);
      const calls = vi.fn(async (input) => claims.reserveForSigning(input));
      for (const broker of brokers.slice(0, 2)) {
        registerTransferRequestResponders(broker, { reserveForSigning: calls }, drafts);
      }
      await Promise.all(brokers.slice(0, 2).map((broker) => broker.flush()));

      const validation = validateDraftResponseSchema.parse(await brokers[2].request(
        TOPOLOGY_REQUEST_SUBJECTS.VALIDATE_DRAFT, claim,
      ));
      expect(validation.status).toBe('OK');
      const retries = await Promise.all(Array.from({ length: 3 }, () =>
        brokers[2].request(TOPOLOGY_REQUEST_SUBJECTS.RESERVE, claim),
      ));
      const [first, ...others] = retries.map((response) => reserveTransferResponseSchema.parse(response));
      const conflict = reserveTransferResponseSchema.parse(await brokers[2].request(
        TOPOLOGY_REQUEST_SUBJECTS.RESERVE, { ...claim, documentId: randomUUID() },
      ));
      expect(first.status).toBe('OK');
      expect(others).toEqual([first, first]);
      expect(conflict.status).toBe('CONFLICT');
      expect(calls).toHaveBeenCalledTimes(4);
    } finally {
      await Promise.all(brokers.map((broker) => broker.disconnect()));
      await graph.run(`
        MATCH (n)
        WHERE n.testRun = $runId OR (n:TransferClaim AND n.documentId = $documentId)
          OR (n:TransferClaimRequisition AND n.requisitionNumber = $requisitionNumber)
        DETACH DELETE n
      `, { runId, documentId: claim.documentId, requisitionNumber: claim.requisitionNumber });
      await graph.close();
      await driver.close();
    }
  }, 30_000);
});
