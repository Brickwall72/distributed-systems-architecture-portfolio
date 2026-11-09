// File: services/core/audit-ledger/server/src/registry/overview.schema.ts
import { z } from 'zod';
import { ledgerAuthorizationSchema, sealedTransferSchema } from 'audit-shared';

const overviewAssetSchema = sealedTransferSchema.shape.assets.element.pick({
  id: true,
  name: true,
  serialNumber: true,
});
const overviewDocumentSchema = ledgerAuthorizationSchema.pick({
  documentId: true,
  documentName: true,
  documentType: true,
  signedAt: true,
  signerId: true,
}).extend({ assets: z.array(overviewAssetSchema) });

export const transferOverviewSchema = sealedTransferSchema.pick({
  requisitionNumber: true,
  sequence: true,
  recordHash: true,
  transferType: true,
  completedAt: true,
  sealedAt: true,
  sender: true,
  receiver: true,
}).extend({
  initiatedAt: sealedTransferSchema.shape.date,
  authorization: overviewDocumentSchema,
  receipts: z.array(overviewDocumentSchema),
});

export const transferOverviewInputSchema = sealedTransferSchema
  .superRefine((record, context) => {
    const authorized = new Set(record.assets.map((asset) => asset.id));
    for (const id of record.authorization.assetIds) {
      if (!authorized.has(id)) context.addIssue({ code: 'custom', message: `Missing authorization asset ${id}` });
    }
    for (const receipt of record.receipts) {
      const received = new Set(receipt.receivedAssets.map((asset) => asset.id));
      for (const id of receipt.assetIds) {
        if (!received.has(id)) context.addIssue({ code: 'custom', message: `Missing receipt asset ${id}` });
      }
    }
  })
  .transform(({ date, assets, authorization, receipts, ...record }) => ({
    ...record,
    initiatedAt: date,
    authorization: {
      ...authorization,
      assets: assets.filter((asset) => authorization.assetIds.includes(asset.id)),
    },
    receipts: receipts.map(({ receivedAssets, ...receipt }) => ({
      ...receipt,
      assets: receivedAssets.filter((asset) => receipt.assetIds.includes(asset.id)),
    })),
  }))
  .pipe(transferOverviewSchema);
export type TransferOverviewInput = z.output<typeof transferOverviewInputSchema>;
