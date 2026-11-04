// File: services/core/audit-ledger/server/src/services/ledger.schemas.ts
import { z } from 'zod';
import { transferInitiatedEventSchema, TransferReceivedEventSchema } from '@contracts/compliance';
import {
  transferEventCreatedEventSchema,
  transferEventUpdatedEventSchema,
  transferEventUpdatedDataSchema,
  transferEventCompletedEventSchema,
} from '@contracts/topology';

/** Envelope facts kept with every applied event; the CloudEvent wrapper itself is not stored. */
export const eventMetaSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  source: z.string(),
  occurredAt: z.string().datetime(),
  correlationId: z.string().nullable().optional(),
});
export type EventMeta = z.infer<typeof eventMetaSchema>;

const toMeta = (e: { id: string; type: string; source: string; time: string; correlationId?: string | null }) => ({
  eventId: e.id,
  eventType: e.type,
  source: e.source,
  occurredAt: e.time,
  correlationId: e.correlationId,
});

/** Builds an entry-point schema that splits a CloudEvent into meta + data, then validates the data locally. */
function entryPoint<E extends z.ZodTypeAny, D extends z.ZodTypeAny>(eventSchema: E, dataSchema: D) {
  return eventSchema
    .transform((e: { id: string; type: string; source: string; time: string; correlationId?: string | null; data: unknown }) => ({
      meta: toMeta(e),
      data: e.data,
    }))
    .pipe(z.object({ meta: eventMetaSchema, data: dataSchema }));
}

// The wire schema makes requisitionNumber optional on updated events; the ledger cannot key a draft without it.
const updatedDataSchema = transferEventUpdatedDataSchema.extend({
  requisitionNumber: z.string().min(1),
});

export const handleTransferCreatedSchema = entryPoint(
  transferEventCreatedEventSchema,
  transferEventCreatedEventSchema.shape.data
);
export const handleTransferUpdatedSchema = entryPoint(transferEventUpdatedEventSchema, updatedDataSchema);
export const handleTransferCompletedSchema = entryPoint(
  transferEventCompletedEventSchema,
  transferEventCompletedEventSchema.shape.data
);
export const handleTransferInitiatedSchema = entryPoint(
  transferInitiatedEventSchema,
  transferInitiatedEventSchema.shape.data
);
export const handleTransferReceivedSchema = entryPoint(
  TransferReceivedEventSchema,
  TransferReceivedEventSchema.shape.data
);

export type HandleTransferCreatedInput = z.infer<typeof handleTransferCreatedSchema>;
export type HandleTransferUpdatedInput = z.infer<typeof handleTransferUpdatedSchema>;
export type HandleTransferCompletedInput = z.infer<typeof handleTransferCompletedSchema>;
export type HandleTransferInitiatedInput = z.infer<typeof handleTransferInitiatedSchema>;
export type HandleTransferReceivedInput = z.infer<typeof handleTransferReceivedSchema>;
