// File: services/core/compliance-service/server/src/services/signing/signing-boundary.integration.test.ts
// @vitest-environment node
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { Pool } from 'pg';
import { EventBroker } from '@shared/messaging';
import { TOPOLOGY_EVENT_SUBJECTS, type TransferClaim } from '@contracts/topology';
import { COMPLIANCE_EVENT_SUBJECTS } from '@contracts/compliance';
import { PDF_SUBJECTS } from '@contracts/pdf';
import { ESIGN_COMMAND_SUBJECTS } from '@contracts/esign';
import { ComplianceEventConsumer, TopologyNatsClient } from '../../messaging';
import { DocumentsRepository, SignedOutboxRepository, SigningOperationsRepository } from '../../repositories';
import { TransferService } from '../transfer.service';
import { NatsSigningCoordinator, SignedOutboxService } from './index';
import { createComplianceGateway } from '../../routes';

describe('cross-service signing boundary', () => {
  it('validates and commits physical partial receipts and C2 transfers through NATS', async () => {
    const databaseUrl = process.env.COMPLIANCE_TEST_DATABASE_URL;
    const graphUrl = process.env.CLAIM_TEST_NEO4J_URI;
    const natsUrl = process.env.SIGNING_TEST_NATS_URL;
    if (!databaseUrl || !graphUrl || !natsUrl) throw new Error('Isolated PostgreSQL, Neo4j and NATS test URLs are required');

    const topologyRoot = path.resolve(process.cwd(), '../..', 'topology-service/server');
    const { default: neo4j } = await import(`${topologyRoot}/node_modules/neo4j-driver/lib/index.js`);
    const { TransferClaimsRepository } = await import(`${topologyRoot}/src/repositories/transfers/claims/transfer-claims.repository.ts`);
    const { TransferDraftRepository } = await import(`${topologyRoot}/src/repositories/transfers/draft/transfer-draft.repository.ts`);
    const { registerTransferRequestResponders } = await import(`${topologyRoot}/src/messaging/transfer-requests.responder.ts`);
    const { startSignedTransferConsumer } = await import(`${topologyRoot}/src/messaging/signed-transfer.consumer.ts`);
    const { TransferOutboxRepository } = await import(`${topologyRoot}/src/repositories/transfers/outbox/transfer-outbox.repository.ts`);
    const { TransferOutboxService } = await import(`${topologyRoot}/src/services/transfer-outbox.service.ts`);
    const auditRoot = path.resolve(process.cwd(), '../..', 'audit-ledger/server');
    const { AuditEventConsumer } = await import(`${auditRoot}/src/messaging/consumer.ts`);
    const { createInMemoryLedger } = await import(`${auditRoot}/src/services/ledger.test-support.ts`);
    const driver = neo4j.driver(graphUrl);
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const broker = new EventBroker(natsUrl);
    const runId = randomUUID();
    const sender = `sender-${runId}`;
    const receiver = `receiver-${runId}`;
    const asset = `asset-${runId}`;
    const secondAsset = `second-${runId}`;
    const remoteAsset = `remote-${runId}`;
    const requisitionNumber = `REQ-${runId}`;
    const documentIds: string[] = [];
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
        CREATE TEMP TABLE compliance_signed_outbox (
          event_id text PRIMARY KEY, document_id uuid NOT NULL, subject text NOT NULL, payload jsonb NOT NULL,
          published_at timestamptz, lease_id uuid, lease_until timestamptz,
          next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text, created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TEMP TABLE compliance_transfer_participants (
          requisition_number text PRIMARY KEY, transfer_event_id uuid UNIQUE NOT NULL,
          sender_org_id text NOT NULL, receiver_org_id text NOT NULL
        );
        CREATE TEMP TABLE compliance_draft_bindings (
          document_id uuid PRIMARY KEY, creator_id text NOT NULL, creator_org_id text NOT NULL,
          binding jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      const graph = driver.session();
      try {
        await graph.run(`
          CREATE (s:Organization {id: $sender, name: 'Sender', type: 'CONTRACTOR', testRun: $runId}),
            (r:Organization {id: $receiver, name: 'Receiver', type: 'CONTRACTOR', testRun: $runId}),
            (a:Asset {id: $asset, name: 'Real asset', nomenclature: 'Actual', serialNumber: 'SN',
              type: 'Test', controlType: 'LOCAL', status: 'AVAILABLE', testRun: $runId}),
            (b:Asset {id: $secondAsset, name: 'Second asset', nomenclature: 'Second', serialNumber: 'SN-2',
              type: 'Test', controlType: 'LOCAL', status: 'AVAILABLE', testRun: $runId}),
            (c:Asset {id: $remoteAsset, name: 'Remote asset', nomenclature: 'Remote', serialNumber: 'SN-3',
              type: 'Test', controlType: 'REMOTE', status: 'AVAILABLE', testRun: $runId}),
            (s)-[:HAS_CUSTODY]->(a), (s)-[:HAS_CUSTODY]->(b), (s)-[:HAS_CUSTODY]->(c)
        `, { sender, receiver, asset, secondAsset, remoteAsset, runId });
      } finally {
        await graph.close();
      }

      await broker.connect();
      await broker.ensureStream(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL]);
      await broker.ensureStream(TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME, [TOPOLOGY_EVENT_SUBJECTS.WILDCARD_ALL]);
      const claims = new TransferClaimsRepository(driver);
      registerTransferRequestResponders(broker, claims, new TransferDraftRepository(driver));
      await startSignedTransferConsumer(broker, claims);
      const topology = new TopologyNatsClient(broker);
      const pdfCommands: { html: string }[] = [];
      let signingRequests = 0;
      broker.respond(PDF_SUBJECTS.GENERATE_PDF, async (command) => {
        pdfCommands.push(command);
        return { success: true, storageBucket: 'bucket', storageKey: 'draft', fileHash: 'a'.repeat(64),
          presignedUrl: 'http://localhost:9000/bucket/draft', jobId: 'draft-job' };
      });
      broker.respond(ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT, async (command) => {
        signingRequests += 1;
        return { success: true, storageBucket: 'bucket', storageKey: `signed/${command.documentId}`, fileHash: 'b'.repeat(64),
          presignedUrl: 'http://localhost:9000/bucket/signed', signedAt: '2026-01-01T00:00:00.000Z',
          uploadedAt: '2026-01-01T00:00:00.000Z' };
      });
      const operations = new SigningOperationsRepository(pool);
      const documents = new DocumentsRepository(pool);
      await new ComplianceEventConsumer(broker, new TransferService(documents)).start();
      const ledger = createInMemoryLedger();
      await new AuditEventConsumer(broker, ledger.service).start();
      const outbox = new TransferOutboxService(new TransferOutboxRepository(driver), broker);
      const signedOutbox = new SignedOutboxRepository(pool);
      const signedPublisher = new SignedOutboxService(signedOutbox, broker);
      const coordinator = new NatsSigningCoordinator(operations, topology, broker, signedOutbox);
      const awaitApplication = async (id: string) => {
        while (await signedPublisher.publishNext()) { /* drain the durable publish intents */ }
        const deadline = Date.now() + 10000;
        const graph = driver.session();
        try {
          while (Date.now() < deadline) {
            const result = await graph.run('MATCH (c:TransferClaim {documentId: $id}) RETURN c.state AS state', { id });
            if (result.records[0]?.get('state') === 'COMMITTED') break;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } finally {
          await graph.close();
        }
        expect(await outbox.publishNext()).toBe(true);
        while (Date.now() < deadline) {
          if ((await documents.findById(id, { kind: 'auditor' }))?.topologyApplicationStatus === 'APPLIED') return;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(`Topology result was not reconciled for ${id}`);
      };
      const compliance = express();
      compliance.use(express.json());
      compliance.use((req, _res, next) => {
        req.identity = req.get('x-test-role') === 'auditor'
          ? { sub: 'auditor', signerId: 'auditor', orgId: null, roles: ['auditor'] }
          : { sub: 'creator', signerId: 'creator', orgId: req.get('x-test-org') ?? sender, roles: ['org-member'] };
        next();
      });
      compliance.use('/api/v1', createComplianceGateway({
        broker, repository: documents, topology, signingOperations: operations, signingCoordinator: coordinator,
        getSignedDownloadUrl: async () => 'http://localhost:9000/bucket/fresh',
      }));
      const common = {
        draftHash: 'a'.repeat(64), creatorId: 'creator', storageBucket: 'bucket',
        storageKey: 'draft', senderOrgId: sender, receiverOrgId: receiver, requisitionNumber,
        transferType: 'PHYSICAL_TRANSFER' as const, assetIds: [asset, secondAsset],
      };
      const command = (claim: TransferClaim) => ({
        documentId: claim.documentId, documentName: claim.templateId, documentType: claim.operation,
        signerId: claim.signerOrgId, requisitionNumber, storageBucket: 'bucket', storageKey: 'draft',
        fileHash: common.draftHash, signatureImageBase64: 'signature',
      });
      const draftResponse = await supertest(compliance).post('/api/v1/templates/asset-transfer-authorization/drafts').send({
        data: {
          requisitionNumber, sourceOrg: { id: sender, name: 'Forged sender' }, targetOrg: { id: receiver, name: 'Forged receiver' },
          assets: [{ id: asset, nomenclature: 'Forged asset', serialNumber: 'fake' }, { id: secondAsset }],
        },
      }).expect(201);
      await supertest(compliance).post('/api/v1/templates/asset-transfer-authorization/drafts')
        .set('x-test-role', 'auditor').send({ data: {} }).expect(403);
      const authorizationId = draftResponse.body.documentId as string;
      documentIds.push(authorizationId);
      const pdfCommand = pdfCommands[0];
      expect(pdfCommand.html).toContain('Actual');
      expect(pdfCommand.html).not.toContain('Forged');
      await supertest(compliance).post('/api/v1/documents/sign').send({
        ...draftResponse.body, senderOrgId: sender, receiverOrgId: receiver, assetIds: [asset, secondAsset],
        signerId: 'creator', signatureImageBase64: 'signature',
      }).expect(200, { presignedUrl: 'http://localhost:9000/bucket/fresh' });
      await awaitApplication(authorizationId);
      const indexed = await documents.findById(authorizationId, { kind: 'organization', orgId: sender });
      if (!indexed?.transferEventId) throw new Error('Committed transfer is missing');
      const receipt: TransferClaim = {
        ...common, assetIds: [asset], documentId: randomUUID(), templateId: 'asset-transfer-receipt',
        signerOrgId: receiver, operation: 'RECEIPT' as const, transferEventId: indexed.transferEventId,
      };
      expect((await topology.validateDraft(receipt)).assets[0].status).toBe('IN_TRANSIT');
      const receiptDraft = await supertest(compliance).post('/api/v1/templates/asset-transfer-receipt/drafts')
        .set('x-test-org', receiver).send({
          data: { requisitionNumber, transferEventId: indexed.transferEventId,
            sourceOrg: { id: sender }, targetOrg: { id: receiver }, assets: [{ id: asset }] },
        }).expect(201);
      receipt.documentId = receiptDraft.body.documentId as string;
      documentIds.push(receipt.documentId);
      const receiptBody = { ...receiptDraft.body, senderOrgId: sender, receiverOrgId: receiver, assetIds: [asset],
        transferEventId: indexed.transferEventId, signerId: 'creator', signatureImageBase64: 'signature' };
      await supertest(compliance).post('/api/v1/documents/sign').send(receiptBody).expect(403);
      await supertest(compliance).post('/api/v1/documents/sign').set('x-test-org', receiver)
        .send(receiptBody).expect(200);
      await awaitApplication(receipt.documentId);
      expect((await documents.findById(authorizationId, { kind: 'organization', orgId: sender }))?.status)
        .toBe('PARTIALLY_COMPLETED');
      expect((await documents.findById(receipt.documentId, { kind: 'organization', orgId: receiver }))?.status)
        .toBe('COMPLETED');
      const finalReceipt = { ...receipt, documentId: randomUUID(), assetIds: [secondAsset] };
      documentIds.push(finalReceipt.documentId);
      await topology.validateDraft(finalReceipt);
      await operations.enqueue(finalReceipt, command(finalReceipt));
      expect(await coordinator.processNext(finalReceipt.documentId)).toBe(true);
      await awaitApplication(finalReceipt.documentId);

      const c2 = {
        ...common, documentId: randomUUID(), templateId: 'authority-transfer-authorization',
        requisitionNumber: `${requisitionNumber}-C2`, transferType: 'C2_TRANSFER' as const,
        assetIds: [remoteAsset], signerOrgId: sender, operation: 'AUTHORIZATION' as const,
      };
      documentIds.push(c2.documentId);
      await topology.validateDraft(c2);
      await operations.enqueue(c2, { ...command(c2), requisitionNumber: c2.requisitionNumber });
      expect(await coordinator.processNext(c2.documentId)).toBe(true);
      await awaitApplication(c2.documentId);
      const verify = driver.session();
      try {
        const result = await verify.run(`
          MATCH (owner:Organization)-[:HAS_CUSTODY]->(asset:Asset {id: $asset})
          MATCH (event:TransferEvent {requisitionNumber: $requisitionNumber})
          RETURN owner.id AS owner, asset.status AS status, event.status AS transferStatus
        `, { asset, requisitionNumber });
        expect(result.records[0].get('owner')).toBe(receiver);
        expect(result.records[0].get('status')).toBe('AVAILABLE');
        expect(result.records[0].get('transferStatus')).toBe('COMPLETED');
      } finally {
        await verify.close();
      }
      expect(await documents.findById(authorizationId, { kind: 'organization', orgId: receiver })).not.toBeNull();
      expect(await documents.findById(receipt.documentId, { kind: 'organization', orgId: sender })).not.toBeNull();
      expect(await documents.findById(receipt.documentId, { kind: 'organization', orgId: 'other' })).toBeNull();
      expect((await documents.findById(c2.documentId, { kind: 'organization', orgId: receiver }))?.status).toBe('COMPLETED');
      expect(pdfCommands).toHaveLength(2);
      expect(signingRequests).toBe(4);
      const deadline = Date.now() + 10000;
      while (ledger.sealed.length < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(ledger.deadLetters).toHaveLength(0);
      expect(ledger.sealed.map((entry: { requisitionNumber: string }) => entry.requisitionNumber).sort())
        .toEqual([requisitionNumber, `${requisitionNumber}-C2`].sort());
    } finally {
      await broker.disconnect();
      const graph = driver.session();
      try {
        await graph.run(`
          MATCH (n) WHERE n.testRun = $runId OR (n:TransferClaim AND n.documentId IN $documentIds)
            OR (n:TransferClaimRequisition AND n.requisitionNumber IN [$req, $c2Req])
            OR (n:TransferEvent AND n.requisitionNumber IN [$req, $c2Req])
          DETACH DELETE n
        `, { runId, req: requisitionNumber, c2Req: `${requisitionNumber}-C2`, documentIds });
      } finally {
        await graph.close();
        await driver.close();
        await pool.end();
      }
    }
  }, 30000);
});
