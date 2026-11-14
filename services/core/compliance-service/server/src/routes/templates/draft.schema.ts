// File: services/core/compliance-service/server/src/routes/templates/draft.schema.ts
import { z } from 'zod';

export const draftInputSchema = z.object({
  sourceOrg: z.object({ id: z.string().min(1) }),
  targetOrg: z.object({ id: z.string().min(1) }),
  assets: z.array(z.object({ id: z.string().min(1) })).min(1),
  transferEventId: z.string().uuid().optional(),
});
export type DraftInput = z.infer<typeof draftInputSchema>;

export const draftPreparationSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    requisitionNumber: z.string(),
    hydrationData: z.record(z.unknown()),
    sourceOrgId: z.string(),
    targetOrgId: z.string(),
    assetIds: z.array(z.string()),
    transferEventId: z.string().optional(),
  }),
  z.object({
    success: z.literal(false),
    status: z.union([z.literal(400), z.literal(403), z.literal(409), z.literal(503)]),
    body: z.object({ error: z.string(), code: z.string(), timestamp: z.string() }),
  }),
]);
export type DraftPreparation = z.infer<typeof draftPreparationSchema>;
