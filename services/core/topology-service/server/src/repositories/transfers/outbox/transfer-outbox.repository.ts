// File: services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts
import { randomUUID } from 'node:crypto';
import type { Driver } from 'neo4j-driver';
import { z } from 'zod';
import {
  TOPOLOGY_EVENT_SUBJECTS,
  transferEventCreatedEventSchema,
  transferEventUpdatedEventSchema,
  transferEventCompletedEventSchema,
} from '@contracts/topology';

const outboxItemBaseSchema = z.object({
  documentId: z.string().uuid(),
  leaseId: z.string().uuid(),
});
export const transferOutboxItemSchema = z.discriminatedUnion('subject', [
  outboxItemBaseSchema.extend({
    subject: z.literal(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED),
    event: transferEventCreatedEventSchema,
  }),
  outboxItemBaseSchema.extend({
    subject: z.literal(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED),
    event: transferEventUpdatedEventSchema,
  }),
  outboxItemBaseSchema.extend({
    subject: z.literal(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED),
    event: transferEventCompletedEventSchema,
  }),
]);
export type TransferOutboxItem = z.infer<typeof transferOutboxItemSchema>;

export class TransferOutboxRepository {
  constructor(private readonly driver: Driver) {}

  async claimNext(): Promise<TransferOutboxItem | null> {
    const leaseId = randomUUID();
    const session = this.driver.session();
    try {
      const item = await session.executeWrite(async (tx) => {
        const candidates = await tx.run(`
          MATCH (claim:TransferClaim {state: 'COMMITTED', outboxPublished: false})
          WHERE (claim.outboxLeaseUntil IS NULL OR claim.outboxLeaseUntil <= datetime())
            AND NOT EXISTS {
              MATCH (earlier:TransferClaim {state: 'COMMITTED', outboxPublished: false})
              WHERE earlier.transferEventId = claim.transferEventId
                AND earlier.outboxSequence < claim.outboxSequence
            }
          RETURN claim.documentId AS documentId, claim.transferEventId AS transferEventId
          ORDER BY claim.transferEventId, claim.outboxSequence
          LIMIT 1
        `);
        const candidate = candidates.records[0];
        if (!candidate) return null;
        const result = await tx.run(`
          MATCH (event:TransferEvent {id: $transferEventId})
          SET event.outboxLockVersion = coalesce(event.outboxLockVersion, 0) + 1
          WITH event
          MATCH (claim:TransferClaim {documentId: $documentId})
          SET claim.outboxLockVersion = coalesce(claim.outboxLockVersion, 0) + 1
          WITH event, claim
          WHERE claim.state = 'COMMITTED' AND claim.outboxPublished = false
            AND claim.transferEventId = event.id
            AND (claim.outboxLeaseUntil IS NULL OR claim.outboxLeaseUntil <= datetime())
            AND NOT EXISTS {
              MATCH (earlier:TransferClaim {state: 'COMMITTED', outboxPublished: false})
              WHERE earlier.transferEventId = claim.transferEventId
                AND earlier.outboxSequence < claim.outboxSequence
            }
          SET claim.outboxLeaseId = $leaseId, claim.outboxLeaseUntil = datetime() + duration({seconds: 30})
          RETURN claim.documentId AS documentId, claim.outboxSubject AS subject, claim.outboxPayload AS payload
        `, {
          documentId: candidate.get('documentId'),
          transferEventId: candidate.get('transferEventId'),
          leaseId,
        });
        const row = result.records[0];
        if (!row) return null;
        return { documentId: row.get('documentId'), subject: row.get('subject'), payload: row.get('payload') };
      });
      if (!item) return null;
      const subject = z.enum([
        TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED,
        TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED,
        TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED,
      ]).parse(item.subject);
      const payload: unknown = JSON.parse(z.string().parse(item.payload));
      let event: unknown;
      if (subject === TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED) {
        event = transferEventCreatedEventSchema.parse(payload);
      } else if (subject === TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED) {
        event = transferEventUpdatedEventSchema.parse(payload);
      } else {
        event = transferEventCompletedEventSchema.parse(payload);
      }
      return transferOutboxItemSchema.parse({ documentId: item.documentId, leaseId, subject, event });
    } finally {
      await session.close();
    }
  }

  async markPublished(item: TransferOutboxItem): Promise<void> {
    const session = this.driver.session();
    try {
      await session.executeWrite(async (tx) => {
        const result = await tx.run(`
          MATCH (claim:TransferClaim {documentId: $documentId})
          SET claim.outboxLockVersion = coalesce(claim.outboxLockVersion, 0) + 1
          WITH claim
          WHERE claim.state = 'COMMITTED' AND claim.outboxPublished = false AND claim.outboxLeaseId = $leaseId
          SET claim.outboxPublished = true, claim.outboxPublishedAt = datetime()
          REMOVE claim.outboxLeaseId, claim.outboxLeaseUntil
          RETURN claim.documentId AS documentId
        `, { documentId: item.documentId, leaseId: item.leaseId });
        if (!result.records.length) throw new Error('Transfer outbox lease was lost before acknowledgement');
      });
    } finally {
      await session.close();
    }
  }
}
