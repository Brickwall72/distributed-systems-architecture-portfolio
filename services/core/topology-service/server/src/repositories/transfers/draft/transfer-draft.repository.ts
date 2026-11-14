// File: services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts
import type { Driver } from 'neo4j-driver';
import {
  transferDraftFactsSchema, transferDraftValidationSchema,
  type TransferDraftFacts, type TransferDraftValidation,
} from '@contracts/topology';
import { TransferClaimConflict } from '../claims';

export class TransferDraftRepository {
  constructor(private readonly driver: Driver) {}

  async validate(input: TransferDraftValidation): Promise<TransferDraftFacts> {
    const request = transferDraftValidationSchema.parse(input);
    const session = this.driver.session();
    try {
      return await session.executeRead(async (tx) => {
        const result = await tx.run(`
          MATCH (sender:Organization {id: $senderOrgId}), (receiver:Organization {id: $receiverOrgId})
          UNWIND $assetIds AS id
          MATCH (asset:Asset {id: id})
          WITH sender, receiver, collect(asset) AS assets
          WHERE size(assets) = size($assetIds)
            AND all(asset IN assets WHERE
              size([(owner:Organization)-[:HAS_CUSTODY]->(asset) | owner.id]) = 1
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
          RETURN properties(sender) AS sender, properties(receiver) AS receiver,
            [asset IN assets | asset {
              .id, .name, .nomenclature, .serialNumber, .type, .controlType, .status,
              currentOwnerId: sender.id
            }] AS assets
        `, { ...request, transferEventId: request.transferEventId ?? null });
        const row = result.records[0];
        if (!row) throw new TransferClaimConflict('Transfer state is not available for this draft');
        return transferDraftFactsSchema.parse({
          sender: row.get('sender'),
          receiver: row.get('receiver'),
          assets: row.get('assets'),
        });
      });
    } finally {
      await session.close();
    }
  }
}
