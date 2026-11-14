// File: services/core/compliance-service/server/src/services/signing/nats-signing-boundary.integration.test.ts
// @vitest-environment node
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Pool } from 'pg';
import { EventBroker } from '@shared/messaging';
import { ESIGN_COMMAND_SUBJECTS } from '@contracts/esign';
import { COMPLIANCE_EVENT_SUBJECTS } from '@contracts/compliance';
import { TOPOLOGY_EVENT_SUBJECTS } from '@contracts/topology';
import { DocumentsRepository, SignedOutboxRepository, SigningOperationsRepository } from '../../repositories';
import { ComplianceEventConsumer, TopologyNatsClient } from '../../messaging';
import { TransferService } from '../transfer.service';
import { NatsSigningCoordinator, SignedOutboxService } from './index';

describe('NATS signing boundary', () => {
  it('returns a signed result before topology is available to consume and later applies the reserved event', async () => {
    const graphUrl = process.env.CLAIM_TEST_NEO4J_URI;
    const databaseUrl = process.env.COMPLIANCE_TEST_DATABASE_URL;
    const natsUrl = process.env.SIGNING_TEST_NATS_URL;
    if (!graphUrl || !databaseUrl || !natsUrl) throw new Error('Isolated Neo4j, PostgreSQL and NATS are required');
    const topologyRoot = path.resolve(process.cwd(), '../..', 'topology-service/server');
    const { default: neo4j } = await import(`${topologyRoot}/node_modules/neo4j-driver/lib/index.js`);
    const { TransferClaimsRepository } = await import(`${topologyRoot}/src/repositories/transfers/claims/transfer-claims.repository.ts`);
    const { TransferDraftRepository } = await import(`${topologyRoot}/src/repositories/transfers/draft/transfer-draft.repository.ts`);
    const { TransferOutboxRepository } = await import(`${topologyRoot}/src/repositories/transfers/outbox/transfer-outbox.repository.ts`);
    const { TransferOutboxService } = await import(`${topologyRoot}/src/services/transfer-outbox.service.ts`);
    const { registerTransferRequestResponders } = await import(`${topologyRoot}/src/messaging/transfer-requests.responder.ts`);
    const { startSignedTransferConsumer } = await import(`${topologyRoot}/src/messaging/signed-transfer.consumer.ts`);
    const driver = neo4j.driver(graphUrl);
    const graph = driver.session();
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const broker = new EventBroker(natsUrl);
    const runId = randomUUID();
    const documentId = randomUUID();
    const sender = `sender-${runId}`;
    const receiver = `receiver-${runId}`;
    const asset = `asset-${runId}`;
    const claim = {
      documentId, draftHash: 'a'.repeat(64), creatorId: 'creator', templateId: 'asset-transfer-authorization',
      storageBucket: 'bucket', storageKey: 'draft', signerOrgId: sender, senderOrgId: sender, receiverOrgId: receiver,
      requisitionNumber: `req-${runId}`, transferType: 'PHYSICAL_TRANSFER' as const, operation: 'AUTHORIZATION' as const,
      assetIds: [asset],
    };
    const command = {
      documentId, documentName: claim.templateId, documentType: claim.operation, signerId: 'signer',
      requisitionNumber: claim.requisitionNumber, storageBucket: 'bucket', storageKey: 'draft',
      fileHash: claim.draftHash, signatureImageBase64: 'signature',
    };
    try {
      await pool.query(`
        CREATE TEMP TABLE compliance_signing_operations (
          document_id uuid PRIMARY KEY, request_hash text NOT NULL, claim jsonb NOT NULL,
          command jsonb, state text NOT NULL, signed_result jsonb, lease_id uuid, lease_until timestamptz,
          next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error_code text,
          created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TEMP TABLE compliance_documents (
          id uuid PRIMARY KEY, name text NOT NULL, type text NOT NULL, transfer_type text NOT NULL,
          requisition_number text NOT NULL, storage_bucket text NOT NULL, storage_key text NOT NULL,
          status text NOT NULL, signer_id text NOT NULL, file_hash text NOT NULL, transfer_event_id uuid,
          topology_application_status text NOT NULL DEFAULT 'APPLIED', topology_pending_at timestamptz,
          created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
        );
        CREATE TEMP TABLE compliance_transfer_participants (
          requisition_number text PRIMARY KEY, transfer_event_id uuid UNIQUE NOT NULL,
          sender_org_id text NOT NULL, receiver_org_id text NOT NULL
        );
        CREATE TEMP TABLE compliance_signed_outbox (
          event_id text PRIMARY KEY, document_id uuid NOT NULL, subject text NOT NULL, payload jsonb NOT NULL,
          published_at timestamptz, lease_id uuid, lease_until timestamptz,
          next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text, created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await graph.run('CREATE CONSTRAINT idx_claim_document IF NOT EXISTS FOR (c:TransferClaim) REQUIRE c.documentId IS UNIQUE');
      await graph.run('CREATE CONSTRAINT idx_claim_req IF NOT EXISTS FOR (r:TransferClaimRequisition) REQUIRE r.requisitionNumber IS UNIQUE');
      await graph.run(`
        CREATE (sender:Organization {id: $sender, name: 'Sender', type: 'CONTRACTOR', testRun: $runId}),
          (:Organization {id: $receiver, name: 'Receiver', type: 'CONTRACTOR', testRun: $runId}),
          (asset:Asset {id: $asset, name: 'Asset', nomenclature: 'Actual', serialNumber: 'SN',
            type: 'Test', controlType: 'LOCAL', status: 'AVAILABLE', testRun: $runId}),
          (sender)-[:HAS_CUSTODY]->(asset)
      `, { sender, receiver, asset, runId });
      await broker.connect();
      await broker.ensureStream(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL]);
      await broker.ensureStream(TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME, [TOPOLOGY_EVENT_SUBJECTS.WILDCARD_ALL]);
      const claims = new TransferClaimsRepository(driver);
      registerTransferRequestResponders(broker, claims, new TransferDraftRepository(driver));
      broker.respond(ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT, async () => ({
        success: true, storageBucket: 'bucket', storageKey: 'signed', fileHash: 'b'.repeat(64),
        presignedUrl: 'http://localhost:9000/bucket/signed', signedAt: '2026-01-01T00:00:00.000Z',
        uploadedAt: '2026-01-01T00:00:00.000Z',
      }));
      const operations = new SigningOperationsRepository(pool);
      const outbox = new SignedOutboxRepository(pool);
      const coordinator = new NatsSigningCoordinator(operations, new TopologyNatsClient(broker), broker, outbox);
      await operations.enqueue(claim, command);
      expect(await coordinator.processNext(documentId)).toBe(true);
      expect(await operations.find(documentId)).toMatchObject({ state: 'COMPLETED', command: null });
      const before = await graph.run('MATCH (a:Asset {id: $asset}) RETURN a.status AS status', { asset });
      expect(before.records[0].get('status')).toBe('AVAILABLE');
      const document = await pool.query('SELECT transfer_event_id, topology_application_status FROM compliance_documents WHERE id = $1', [documentId]);
      const transferEventId = document.rows[0].transfer_event_id;
      expect(document.rows[0].topology_application_status).toBe('PENDING');

      const publisher = new SignedOutboxService(outbox, broker);
      expect(await publisher.publishNext()).toBe(true);
      expect(await publisher.publishNext()).toBe(true);
      await startSignedTransferConsumer(broker, claims);
      let state = '';
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await graph.run('MATCH (a:Asset {id: $asset}) RETURN a.status AS status', { asset });
        state = result.records[0].get('status');
        if (state === 'IN_TRANSIT') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(state).toBe('IN_TRANSIT');
      const committed = await graph.run('MATCH (c:TransferClaim {documentId: $documentId}) RETURN c.transferEventId AS id, c.state AS state', { documentId });
      expect(committed.records[0].get('id')).toBe(transferEventId);
      expect(committed.records[0].get('state')).toBe('COMMITTED');
      const documents = new DocumentsRepository(pool);
      await new ComplianceEventConsumer(broker, new TransferService(documents)).start();
      expect(await new TransferOutboxService(new TransferOutboxRepository(driver), broker).publishNext()).toBe(true);
      let application = 'PENDING';
      for (let attempt = 0; attempt < 100; attempt++) {
        const row = await documents.findById(documentId, { kind: 'auditor' });
        application = row?.topologyApplicationStatus ?? 'MISSING';
        if (application === 'APPLIED') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(application).toBe('APPLIED');
    } finally {
      await broker.disconnect();
      await graph.run(`
        MATCH (n) WHERE n.testRun = $runId OR (n:TransferClaim AND n.documentId = $documentId)
          OR (n:TransferClaimRequisition AND n.requisitionNumber = $requisitionNumber)
          OR (n:TransferEvent AND n.requisitionNumber = $requisitionNumber)
        DETACH DELETE n
      `, { runId, documentId, requisitionNumber: claim.requisitionNumber });
      await graph.close();
      await driver.close();
      await pool.end();
    }
  }, 30_000);
});
