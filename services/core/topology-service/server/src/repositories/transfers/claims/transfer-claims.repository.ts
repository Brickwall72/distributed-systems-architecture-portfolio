// File: services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts
import { createHash, randomUUID } from 'node:crypto';
import { type Driver } from 'neo4j-driver';
import {
  TOPOLOGY_EVENT_SUBJECTS, TOPOLOGY_EVENT_TYPES,
  transferEventCreatedEventSchema, transferEventUpdatedEventSchema, transferEventCompletedEventSchema,
  transferClaimSchema, signedTransferEventSchema, type TransferClaim,
} from '@contracts/topology';
import { transferEventSnapshotSchema } from '../transfer-snapshot.schema';

export { transferClaimSchema, type TransferClaim } from '@contracts/topology';

export class TransferClaimConflict extends Error {}

export class TransferClaimsRepository {
  constructor(private readonly driver: Driver) {}

  async reserveForSigning(input: TransferClaim): Promise<{ transferEventId: string }> {
    const claim = transferClaimSchema.parse(input);
    const assetIds = [...claim.assetIds].sort((a, b) => a.localeCompare(b));
    const digest = createHash('sha256').update(JSON.stringify({ ...claim, assetIds })).digest('hex');
    const proposedTransferEventId = claim.transferEventId ?? randomUUID();
    const session = this.driver.session();
    try {
      return await session.executeWrite(async (tx) => {
        const existing = await tx.run(`
          MERGE (claim:TransferClaim {documentId: $documentId})
          ON CREATE SET claim.digest = $digest, claim.state = 'NEW'
          SET claim.lockVersion = coalesce(claim.lockVersion, 0) + 1
          RETURN claim.digest AS digest, claim.state AS state,
            coalesce(claim.expiresAt > datetime(), false) AS active,
            claim.transferEventId AS transferEventId
        `, { documentId: claim.documentId, digest });
        const previous = existing.records[0];
        if (previous.get('digest') !== digest) throw new TransferClaimConflict('Document claim does not match');
        const previousState = previous.get('state');
        if (previousState === 'COMMITTED') {
          return { transferEventId: previous.get('transferEventId') };
        }
        if (previousState === 'SIGNING') {
          const transferEventId = previous.get('transferEventId');
          if (!transferEventId) throw new TransferClaimConflict('Existing signing claim has no reserved transfer ID');
          return { transferEventId };
        }
        if (previousState === 'RESERVED' && previous.get('active')) {
          throw new TransferClaimConflict('Existing expiring reservation cannot be promoted by this request');
        }
        if (!['NEW', 'RELEASED', 'RESERVED'].includes(previous.get('state'))) {
          throw new TransferClaimConflict('Document claim is no longer available');
        }
        await tx.run(`
          MATCH (claim:TransferClaim {documentId: $documentId})-[reservation:CLAIMS]->(:Asset)
          DELETE reservation
        `, { documentId: claim.documentId });

        if (claim.operation === 'AUTHORIZATION') {
          const requisition = await tx.run(`
            MERGE (guard:TransferClaimRequisition {requisitionNumber: $requisitionNumber})
            SET guard.lockVersion = coalesce(guard.lockVersion, 0) + 1
            WITH guard
            WHERE guard.documentId IS NULL OR guard.documentId = $documentId OR NOT EXISTS {
              MATCH (other:TransferClaim {documentId: guard.documentId})
              WHERE other.state IN ['SIGNING', 'COMMITTED']
                OR (other.state = 'RESERVED' AND other.expiresAt > datetime())
            }
            SET guard.documentId = $documentId
            RETURN guard.documentId AS documentId
          `, { requisitionNumber: claim.requisitionNumber, documentId: claim.documentId });
          if (!requisition.records.length) throw new TransferClaimConflict('Requisition is already claimed');
        }

        const locked = await tx.run(`
          UNWIND $assetIds AS id
          MATCH (asset:Asset {id: id})
          WITH asset ORDER BY asset.id
          SET asset.claimLockVersion = coalesce(asset.claimLockVersion, 0) + 1
          RETURN collect(asset.id) AS ids
        `, { assetIds });
        if (locked.records[0].get('ids').length !== assetIds.length) {
          throw new TransferClaimConflict('One or more assets do not exist');
        }

        const result = await tx.run(`
          MATCH (sender:Organization {id: $senderOrgId}), (receiver:Organization {id: $receiverOrgId})
          MATCH (claim:TransferClaim {documentId: $documentId})
          UNWIND $assetIds AS id
          MATCH (asset:Asset {id: id})
          WITH sender, receiver, claim, collect(asset) AS assets
          WHERE all(asset IN assets WHERE
            NOT EXISTS {
              MATCH (other:TransferClaim)-[:CLAIMS]->(asset)
              WHERE other.state = 'SIGNING' OR (other.state = 'RESERVED' AND other.expiresAt > datetime())
            }
            AND size([(owner:Organization)-[:HAS_CUSTODY]->(asset) | owner.id]) = 1
            AND EXISTS { MATCH (sender)-[:HAS_CUSTODY]->(asset) }
            AND asset.controlType = CASE $transferType WHEN 'C2_TRANSFER' THEN 'REMOTE' ELSE 'LOCAL' END
          )
          AND (
            ($operation = 'AUTHORIZATION'
              AND NOT EXISTS { MATCH (:TransferEvent {requisitionNumber: $requisitionNumber}) }
              AND all(asset IN assets WHERE asset.status = 'AVAILABLE'))
            OR
            ($operation = 'RECEIPT'
              AND EXISTS {
                MATCH (sender)-[:DELIVERED_FROM]->(event:TransferEvent {id: $transferEventId, requisitionNumber: $requisitionNumber})-[:DELIVERED_TO]->(receiver)
                WHERE event.type = $transferType AND event.status IN ['IN_PROGRESS', 'PARTIALLY_COMPLETED']
                  AND all(asset IN assets WHERE asset.status = 'IN_TRANSIT'
                    AND EXISTS { MATCH (event)-[:INVOLVES {status: 'IN_TRANSIT'}]->(asset) })
              })
          )
          FOREACH (asset IN assets | CREATE (claim)-[:CLAIMS]->(asset))
          SET claim.state = 'SIGNING',
            claim.createdAt = datetime(),
            claim.expiresAt = null,
            claim.transferEventId = $reservedTransferEventId,
            claim.requestJson = $requestJson
          RETURN claim.documentId AS documentId, claim.transferEventId AS reservedTransferEventId
        `, { ...claim, transferEventId: claim.transferEventId ?? null, assetIds,
          reservedTransferEventId: proposedTransferEventId, requestJson: JSON.stringify(claim) });
        if (!result.records.length) throw new TransferClaimConflict('Transfer state is not available for this claim');
        return { transferEventId: result.records[0].get('reservedTransferEventId') ?? proposedTransferEventId };
      });
    } finally {
      await session.close();
    }
  }

  async commitSigned(input: unknown): Promise<{ transferEventId: string; status: string }> {
    const event = signedTransferEventSchema.parse(input);
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (claim:TransferClaim {documentId: $documentId}) RETURN claim.requestJson AS requestJson',
        { documentId: event.data.documentId },
      );
      const requestJson = result.records[0]?.get('requestJson');
      if (typeof requestJson !== 'string') throw new TransferClaimConflict('Signed event has no durable reservation');
      const claim = transferClaimSchema.parse(JSON.parse(requestJson));
      return await this.commitClaim(claim, event.data);
    } finally {
      await session.close();
    }
  }

  private async commitClaim(
    input: TransferClaim,
    signed: { documentId: string; transferEventId: string; draftHash: string; signedFileHash: string },
  ): Promise<{ transferEventId: string; status: string }> {
    const claim = transferClaimSchema.parse(input);
    const assetIds = [...claim.assetIds].sort((a, b) => a.localeCompare(b));
    const digest = createHash('sha256').update(JSON.stringify({ ...claim, assetIds })).digest('hex');
    const date = new Date().toISOString();
    const session = this.driver.session();
    try {
      return await session.executeWrite(async (tx) => {
        const locked = await tx.run(`
          MATCH (claim:TransferClaim {documentId: $documentId})
          SET claim.lockVersion = coalesce(claim.lockVersion, 0) + 1
          RETURN claim.digest AS digest, claim.state AS state,
            claim.transferEventId AS transferEventId, claim.resultStatus AS resultStatus,
            claim.signedFileHash AS signedFileHash, claim.requestJson AS requestJson
        `, { documentId: claim.documentId });
        const current = locked.records[0];
        if (current?.get('digest') !== digest) throw new TransferClaimConflict('Document claim does not match');
        if (signed.documentId !== claim.documentId || signed.draftHash !== claim.draftHash
          || signed.transferEventId !== current.get('transferEventId') || !current.get('requestJson')
          || (current.get('state') === 'COMMITTED' && current.get('signedFileHash') !== signed.signedFileHash)) {
          throw new TransferClaimConflict('Signed event does not match the reservation');
        }
        if (current.get('state') === 'COMMITTED') {
          return { transferEventId: current.get('transferEventId'), status: current.get('resultStatus') };
        }
        if (current.get('state') !== 'SIGNING') throw new TransferClaimConflict('Claim has not entered signing');
        const transferEventId = current.get('transferEventId');

        if (claim.operation === 'RECEIPT') {
          const event = await tx.run(`
            MATCH (event:TransferEvent {id: $transferEventId, requisitionNumber: $requisitionNumber})
            SET event.claimLockVersion = coalesce(event.claimLockVersion, 0) + 1
            RETURN event.id AS id
          `, { transferEventId, requisitionNumber: claim.requisitionNumber });
          if (!event.records.length) throw new TransferClaimConflict('Transfer does not exist');
        }

        const assets = await tx.run(`
          UNWIND $assetIds AS id
          MATCH (asset:Asset {id: id})
          WITH asset ORDER BY asset.id
          SET asset.claimLockVersion = coalesce(asset.claimLockVersion, 0) + 1
          RETURN collect(asset.id) AS ids
        `, { assetIds });
        if (assets.records[0].get('ids').length !== assetIds.length) {
          throw new TransferClaimConflict('One or more assets do not exist');
        }

        const validation = await tx.run(`
          MATCH (claim:TransferClaim {documentId: $documentId})
          MATCH (sender:Organization {id: $senderOrgId}), (receiver:Organization {id: $receiverOrgId})
          UNWIND $assetIds AS id
          MATCH (claim)-[:CLAIMS]->(asset:Asset {id: id})
          WITH sender, receiver, collect(asset) AS assets
          WHERE size(assets) = size($assetIds)
            AND all(asset IN assets WHERE
              size([(owner:Organization)-[:HAS_CUSTODY]->(asset) | owner.id]) = 1
              AND EXISTS { MATCH (sender)-[:HAS_CUSTODY]->(asset) }
              AND asset.controlType = CASE $transferType WHEN 'C2_TRANSFER' THEN 'REMOTE' ELSE 'LOCAL' END)
            AND (
              ($operation = 'AUTHORIZATION'
                AND NOT EXISTS { MATCH (:TransferEvent {requisitionNumber: $requisitionNumber}) }
                AND all(asset IN assets WHERE asset.status = 'AVAILABLE'))
              OR
              ($operation = 'RECEIPT'
                AND EXISTS {
                  MATCH (sender)-[:DELIVERED_FROM]->(event:TransferEvent {id: $transferEventId, requisitionNumber: $requisitionNumber})-[:DELIVERED_TO]->(receiver)
                  WHERE event.type = $transferType AND event.status IN ['IN_PROGRESS', 'PARTIALLY_COMPLETED']
                    AND all(asset IN assets WHERE asset.status = 'IN_TRANSIT'
                      AND EXISTS { MATCH (event)-[:INVOLVES {status: 'IN_TRANSIT'}]->(asset) })
                })
            )
          RETURN size(assets) AS count
        `, { ...claim, transferEventId, assetIds });
        if (!validation.records.length) throw new TransferClaimConflict('Transfer state changed after reservation');

        if (claim.operation === 'AUTHORIZATION') {
          await tx.run(`
            MATCH (sender:Organization {id: $senderOrgId}), (receiver:Organization {id: $receiverOrgId})
            CREATE (event:TransferEvent {
              id: $transferEventId, requisitionNumber: $requisitionNumber,
              date: $date, type: $transferType,
              status: CASE WHEN $transferType = 'C2_TRANSFER' THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
              updatedAt: datetime()
            })
            CREATE (sender)-[:DELIVERED_FROM]->(event)-[:DELIVERED_TO]->(receiver)
            WITH sender, receiver, event
            UNWIND $assetIds AS id
            MATCH (sender)-[custody:HAS_CUSTODY]->(asset:Asset {id: id})
            CREATE (event)-[:INVOLVES {
              status: CASE WHEN $transferType = 'C2_TRANSFER' THEN 'COMPLETED' ELSE 'IN_TRANSIT' END
            }]->(asset)
            SET asset.status = CASE WHEN $transferType = 'C2_TRANSFER' THEN 'AVAILABLE' ELSE 'IN_TRANSIT' END
            FOREACH (_ IN CASE WHEN $transferType = 'C2_TRANSFER' THEN [1] ELSE [] END |
              DELETE custody
              MERGE (receiver)-[:HAS_CUSTODY]->(asset))
          `, { ...claim, assetIds, transferEventId, date });
        } else {
          await tx.run(`
            MATCH (event:TransferEvent {id: $transferEventId})-[:DELIVERED_TO]->(receiver:Organization {id: $receiverOrgId})
            UNWIND $assetIds AS id
            MATCH (event)-[involves:INVOLVES {status: 'IN_TRANSIT'}]->(asset:Asset {id: id})
            MATCH (:Organization {id: $senderOrgId})-[custody:HAS_CUSTODY]->(asset)
            SET involves.status = 'COMPLETED', asset.status = 'AVAILABLE'
            DELETE custody
            MERGE (receiver)-[:HAS_CUSTODY]->(asset)
            WITH DISTINCT event
            MATCH (event)-[all:INVOLVES]->(:Asset)
            WITH event, collect(all.status) AS statuses
            SET event.status = CASE WHEN all(status IN statuses WHERE status = 'COMPLETED')
              THEN 'COMPLETED' ELSE 'PARTIALLY_COMPLETED' END, event.updatedAt = datetime(),
              event.receiptDocumentIds = coalesce(event.receiptDocumentIds, []) + $documentId
          `, { ...claim, assetIds, transferEventId });
        }

        const snapshots = await tx.run(`
          MATCH (sender:Organization)-[:DELIVERED_FROM]->(event:TransferEvent {id: $transferEventId})-[:DELIVERED_TO]->(receiver:Organization)
          RETURN event.id AS id, event.requisitionNumber AS requisitionNumber,
            event.type AS type, event.date AS date, event.status AS status,
            coalesce(event.receiptDocumentIds, []) AS receiptDocumentIds,
            properties(sender) AS sender, properties(receiver) AS receiver,
            [(event)-[:INVOLVES]->(asset:Asset) | asset {
              .id, .name, .nomenclature, .serialNumber, .type, .controlType, .status,
              currentOwnerId: [(owner:Organization)-[:HAS_CUSTODY]->(asset) | owner.id][0]
            }] AS assets
        `, { transferEventId });
        const row = snapshots.records[0];
        if (!row) throw new TransferClaimConflict('Transfer snapshot is unavailable');
        const snapshot = transferEventSnapshotSchema.parse({
          id: row.get('id'),
          requisitionNumber: row.get('requisitionNumber'),
          type: row.get('type'),
          date: row.get('date'),
          status: row.get('status'),
          sender: row.get('sender'),
          receiver: row.get('receiver'),
          assets: row.get('assets'),
        });
        const receivedAssets = snapshot.assets.filter((item) => assetIds.includes(item.id));
        const receiptDocumentIds: string[] = row.get('receiptDocumentIds');
        const { subject, payload } = this.createOutboxMessage(claim, snapshot, date, receivedAssets, receiptDocumentIds);
        const completed = await tx.run(`
          MATCH (claim:TransferClaim {documentId: $documentId}), (event:TransferEvent {id: $transferEventId})
          OPTIONAL MATCH (claim)-[reservation:CLAIMS]->(:Asset)
          DELETE reservation
          WITH DISTINCT claim, event
          SET event.claimOutboxSequence = coalesce(event.claimOutboxSequence, 0) + 1
          SET claim.state = 'COMMITTED', claim.transferEventId = event.id, claim.resultStatus = event.status,
            claim.outboxSubject = $subject, claim.outboxPayload = $payload, claim.outboxPublished = false,
            claim.outboxSequence = event.claimOutboxSequence,
            claim.signedFileHash = $signedFileHash
          RETURN event.id AS transferEventId, event.status AS status
        `, { documentId: claim.documentId, transferEventId, subject, payload, signedFileHash: signed.signedFileHash });
        return { transferEventId: completed.records[0].get('transferEventId'), status: completed.records[0].get('status') };
      });
    } finally {
      await session.close();
    }
  }

  private createOutboxMessage(
    claim: TransferClaim,
    snapshot: ReturnType<typeof transferEventSnapshotSchema.parse>,
    date: string,
    receivedAssets: typeof snapshot.assets,
    receiptDocumentIds: string[],
  ): { subject: string; payload: string } {
    const eventBase = {
      specversion: '1.0',
      id: `evt_topology_${claim.documentId}`,
      source: 'service:topology-server',
      time: date,
      datacontenttype: 'application/json',
      correlationId: `claim_${claim.documentId}`,
    };
    const baseData = {
      transferEventId: snapshot.id,
      appliedDocumentId: claim.documentId,
      requisitionNumber: snapshot.requisitionNumber,
      transferType: snapshot.type,
      date: snapshot.date,
      sender: snapshot.sender,
      receiver: snapshot.receiver,
      assets: snapshot.assets,
    };
    const completedEvent = snapshot.status === 'COMPLETED';
    let subject: string;
    if (completedEvent) {
      subject = TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED;
    } else if (claim.operation === 'AUTHORIZATION') {
      subject = TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED;
    } else {
      subject = TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED;
    }
    let event;
    if (completedEvent) {
      event = transferEventCompletedEventSchema.parse({
        ...eventBase, type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_COMPLETED,
        data: {
          ...baseData, transferEventStatus: 'COMPLETED', receivedAssets,
          documentId: claim.operation === 'RECEIPT' ? claim.documentId : undefined,
          receiptDocumentIds,
        },
      });
    } else if (claim.operation === 'AUTHORIZATION') {
      event = transferEventCreatedEventSchema.parse({
        ...eventBase, type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_CREATED, data: baseData,
      });
    } else {
      event = transferEventUpdatedEventSchema.parse({
        ...eventBase, type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_UPDATED,
        data: {
          transferEventId: snapshot.id, appliedDocumentId: claim.documentId, requisitionNumber: snapshot.requisitionNumber,
          transferEventStatus: snapshot.status, documentId: claim.documentId, receivedAssets,
        },
      });
    }
    return { subject, payload: JSON.stringify(event) };
  }
}