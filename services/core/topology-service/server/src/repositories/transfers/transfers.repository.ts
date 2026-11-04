// File: services/core/topology-service/server/src/repositories/transfers/transfers.repository.ts
import { BaseRepository } from '../base.repository';
import { transferTypeEnum, TransferStatus, transferStatusEnum } from '@contracts/common';
import { transferOrganizationSnapshotSchema, transferAssetSnapshotSchema } from '@contracts/topology';
import { z } from 'zod';
import { createLogger } from '@shared/express';
import { randomUUID } from 'node:crypto';

const logger = createLogger('Topology:TransfersRepo');

export const updateTransferEventSchema = z.object({
  id: z.string().uuid(),
  assetIds: z.array(z.string()),
});
export type UpdateTransferEvent = z.infer<typeof updateTransferEventSchema>;

export const createTransferEventSchema = updateTransferEventSchema.omit({ id: true }).extend({
  requisitionNumber: z.string(),
  date: z.string().datetime(),
  type: transferTypeEnum,
  senderOrgId: z.string(),
  receiverOrgId: z.string(),
});
export type CreateTransferEvent = z.infer<typeof createTransferEventSchema>;

const transferEventUpdateResultSchema = z.object({
  requisitionNumber: z.string(),
  status: transferStatusEnum,
})
type TransferEventUpdateResult = z.infer<typeof transferEventUpdateResultSchema>;

const transferEventCreationResultSchema = z.object({
  id: z.string().uuid(),
});
type TransferEventCreationResult = z.infer<typeof transferEventCreationResultSchema>;

export const transferEventSnapshotSchema = z.object({
  id: z.string().uuid(),
  requisitionNumber: z.string(),
  type: transferTypeEnum,
  date: z.string().datetime(),
  status: transferStatusEnum,
  sender: transferOrganizationSnapshotSchema,
  receiver: transferOrganizationSnapshotSchema,
  assets: z.array(transferAssetSnapshotSchema).min(1),
});
export type TransferEventSnapshot = z.infer<typeof transferEventSnapshotSchema>;

export class TransfersRepository extends BaseRepository {

  /**
   * Processes a TransferInitiated event:
   * 1. Creates/Updates the TransferEvent node using a generated UUID.
   * 2. Links sender Organization (-[:DELIVERED_FROM]->) and receiver Organization (->[:DELIVERED_TO]->).
   * 3. Sets asset status to 'IN_TRANSIT' and attaches INVOLVES relationship.
   * Note: HAS_CUSTODY is intentionally preserved during transit.
   */
  public async createTransferEvent(params: CreateTransferEvent): Promise<TransferEventCreationResult> {
    const queryParams = { ...params, id: randomUUID() };

    // The requisition number is the unique business key, so redeliveries resolve to the same node
    // and keep its original id and progress instead of colliding with the uniqueness constraint.
    const cypher = `
      MERGE (e:TransferEvent {requisitionNumber: $requisitionNumber})
      ON CREATE SET e.id = $id,
          e.date = $date,
          e.type = $type,
          e.status = 'IN_PROGRESS',
          e.updatedAt = datetime()

      WITH e
      MATCH (sender:Organization {id: $senderOrgId})
      MATCH (receiver:Organization {id: $receiverOrgId})

      MERGE (sender)-[:DELIVERED_FROM]->(e)
      MERGE (e)-[:DELIVERED_TO]->(receiver)

      WITH e
      UNWIND $assetIds AS assetId
      MATCH (asset:Asset {id: assetId})
      MERGE (e)-[inv:INVOLVES]->(asset)
      ON CREATE SET inv.status = 'IN_TRANSIT',
          asset.status = 'IN_TRANSIT'

      WITH DISTINCT e
      RETURN e.id AS id
    `;

    logger.debug(`handleTransferInitiated params:${JSON.stringify(queryParams)}`);

    const results = await this.executeWriteQuery(
      cypher,
      queryParams,
      (record) => ({ id: record.get('id') })
    );

    if (!results[0]) {
      throw new Error(
        `TransferEvent ${params.requisitionNumber} could not be created: missing organization or asset`
      );
    }
    return transferEventCreationResultSchema.parse(results[0]);
  }

  /**
   * Processes a TransferReceived event:
   * 1. Updates specified INVOLVES relationships to completed and restores asset status to 'ACTIVE'.
   * 2. Transfers HAS_CUSTODY to the receiver organization.
   * 3. Evaluates all attached assets to determine if the event is fully COMPLETED or PARTIALLY_COMPLETED.
   */
  public async updateTransferEvent(params: UpdateTransferEvent): Promise<TransferEventUpdateResult> {
    const cypher = `
      MATCH (e:TransferEvent {id: $id})
      MATCH (e)-[:DELIVERED_TO]->(receiver:Organization)

      WITH e, receiver
      UNWIND $assetIds AS assetId
      MATCH (asset:Asset {id: assetId})
      MATCH (e)-[inv:INVOLVES]->(asset)
      SET inv.status = 'COMPLETED',
          asset.status = 'AVAILABLE'

      WITH e, receiver, asset
      // Drop old custody and assign new custody to receiver
      OPTIONAL MATCH (oldOwner:Organization)-[c:HAS_CUSTODY]->(asset)
      DELETE c

      MERGE (receiver)-[:HAS_CUSTODY]->(asset)

      // Evaluate aggregate status of all attached assets
      WITH DISTINCT e
      MATCH (e)-[allInv:INVOLVES]->(:Asset)
      WITH e, collect(allInv.status) AS allStatuses

      WITH e,
           CASE WHEN all(s IN allStatuses WHERE s = 'COMPLETED') THEN 'COMPLETED' ELSE 'PARTIALLY_COMPLETED' END AS calculatedStatus

      SET e.status = calculatedStatus,
          e.updatedAt = datetime()

      RETURN e.requisitionNumber AS requisitionNumber, calculatedStatus AS status
    `;

    const results = await this.executeWriteQuery(
      cypher,
      params,
      (record) => ({
        status: record.get('status') as TransferStatus,
        requisitionNumber: record.get('requisitionNumber')
      })
    );

    if (!results[0]) {
      throw new Error(`TransferEvent ${params.id} not found or has no matching assets`);
    }
    return transferEventUpdateResultSchema.parse(results[0]);
  }

  /**
   * Reads the transfer event with its parties and involved assets as they currently stand,
   * so published events carry a point-in-time snapshot rather than bare identifiers.
   */
  public async findTransferEventSnapshot(id: string): Promise<TransferEventSnapshot> {
    const cypher = `
      MATCH (sender:Organization)-[:DELIVERED_FROM]->(e:TransferEvent {id: $id})-[:DELIVERED_TO]->(receiver:Organization)
      RETURN e.id AS id,
        e.requisitionNumber AS requisitionNumber,
        e.type AS type,
        e.date AS date,
        e.status AS status,
        properties(sender) AS sender,
        properties(receiver) AS receiver,
        [(e)-[:INVOLVES]->(a:Asset) | a {
          .id, .name, .nomenclature, .serialNumber, .type, .controlType, .status,
          currentOwnerId: [(o:Organization)-[:HAS_CUSTODY]->(a) | o.id][0]
        }] AS assets
    `;

    const results = await this.executeReadQuery(
      cypher,
      { id },
      (record) => ({
        id: record.get('id'),
        requisitionNumber: record.get('requisitionNumber'),
        type: record.get('type'),
        date: record.get('date'),
        status: record.get('status'),
        sender: record.get('sender'),
        receiver: record.get('receiver'),
        assets: record.get('assets'),
      })
    );

    if (!results[0]) {
      throw new Error(`TransferEvent ${id} not found or is missing a party`);
    }
    return transferEventSnapshotSchema.parse(results[0]);
  }
}