// File: services/core/topology-service/server/src/repositories/transfers/transfers.repository.ts
import { BaseRepository } from '../base.repository';
import { transferTypeEnum, TransferStatus, transferStatusEnum } from '@contracts/common';
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
          asset.status = 'ACTIVE'

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
}