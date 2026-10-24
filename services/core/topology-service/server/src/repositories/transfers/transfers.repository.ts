// File: services/core/topology-service/server/src/repositories/transfers/transfers.repository.ts
import { BaseRepository } from '../base.repository';
import { transferTypeEnum } from '@contracts/common';
import { z } from 'zod';
import { createLogger } from '@shared/express';
const logger = createLogger('Topology:TransfersRepo');

export const handleTransferReceivedParamsSchema = z.object({
  requisitionNumber: z.string(),
  assetIds: z.array(z.string()),
});
type handleTransferReceivedParams = z.infer<typeof handleTransferReceivedParamsSchema>;

export const handleTransferInitiatedParamsSchema = handleTransferReceivedParamsSchema.extend({
  date: z.string().datetime(),
  type: transferTypeEnum,
  senderOrgId: z.string(),
  receiverOrgId: z.string(),
});
type handleTransferInitiatedParams = z.infer<typeof handleTransferInitiatedParamsSchema>;

export class TransfersRepository extends BaseRepository {

  /**
   * Processes a TransferInitiated event:
   * 1. Creates/Updates the TransferEvent node.
   * 2. Links sender Organization (-[:DELIVERED_FROM]->) and receiver Organization (->[:DELIVERED_TO]->).
   * 3. Sets asset status to 'IN_TRANSIT' and attaches INVOLVES relationship.
   * Note: HAS_CUSTODY is intentionally preserved during transit.
   */
  public async handleTransferInitiated(params: handleTransferInitiatedParams): Promise<void> {
    const cypher = `
      MERGE (e:TransferEvent {requisitionNumber: $requisitionNumber})
      SET e.date = $date,
          e.type = $type,
          e.status = 'IN_TRANSIT',
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
      SET inv.status = 'IN_TRANSIT',
          asset.status = 'IN_TRANSIT'
    `;
    logger.debug(`handleTransferInitiated params:${JSON.stringify(params)}`);
    await this.executeWriteQuery(
      cypher,
      params,
      () => ({})
    );
    if(params.type === 'C2_TRANSFER'){
      void this.handleTransferReceived(handleTransferReceivedParamsSchema.parse(params));
    }
  }

  /**
   * Processes a TransferReceived event:
   * 1. Marks the TransferEvent node as completed.
   * 2. Updates INVOLVES status and restores asset status to 'ACTIVE'.
   * 3. Drops existing HAS_CUSTODY from previous owner and establishes new HAS_CUSTODY with receiver.
   */
  public async handleTransferReceived(params: handleTransferReceivedParams): Promise<void> {
    const cypher = `
      MATCH (e:TransferEvent {requisitionNumber: $requisitionNumber})
      SET e.status = 'COMPLETED',
          e.updatedAt = datetime()

      WITH e
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
    `;

    await this.executeWriteQuery(
      cypher,
      params,
      () => ({})
    );
  }
}