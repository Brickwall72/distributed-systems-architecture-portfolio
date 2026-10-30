// File: services/core/compliance-service/server/src/registry/schemas/transfer-receipt.schema.ts
import { z } from 'zod';

export const transferReceiptAssetInputSchema = z.object({
  nomenclature: z.string(),
  serialNumber: z.string(),
});

export const transferReceiptOrgInputSchema = z.object({
  name: z.string(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
});

export const transferReceiptInputSchema = z.object({
  requisitionNumber: z.string().optional(),
  selectedDate: z.string().optional(),
  sourceOrg: transferReceiptOrgInputSchema.optional(),
  targetOrg: transferReceiptOrgInputSchema.optional(),
  assets: z.array(transferReceiptAssetInputSchema).optional().default([]),
});

const transferReceiptOutputSchema = z.object({
  transferringEntityName: z.string(),
  transferringAddressLine1: z.string(),
  transferringAddressLine2: z.string(),
  receivingEntityName: z.string(),
  receivingAddressLine1: z.string(),
  receivingAddressLine2: z.string(),
  requisitionNumber: z.string().optional(),
  receiptDate: z.string(),
  items: z.array(
    z.object({
      itemNumber: z.number(),
      nomenclature: z.string(),
      serialNumber: z.string(),
      additionalNotes: z.string(),
      unit: z.string(),
      quantity: z.number(),
    })
  ),
});

export const transferReceiptParserPipeline = transferReceiptInputSchema
  .transform(({ sourceOrg, targetOrg, requisitionNumber, selectedDate, assets }) => {
    // Automatically derive placeholder mode from data presence
    const usePlaceholders = !requisitionNumber;
    
    const placeholderItems = usePlaceholders ? [{
      itemNumber: 1,
      nomenclature: '[Received Asset Description Required]',
      serialNumber: '[Serial Number Required]',
      additionalNotes: '',
      unit: 'EA',
      quantity: 1,
    }] : [];

    const items = assets.length > 0
      ? assets.map((asset, idx) => ({
          itemNumber: idx + 1,
          nomenclature: asset.nomenclature,
          serialNumber: asset.serialNumber,
          additionalNotes: '',
          unit: 'EA',
          quantity: 1,
        }))
      : placeholderItems;

    return {
      transferringEntityName: sourceOrg?.name ?? (usePlaceholders ? '[Transferring Entity]' : ''),
      transferringAddressLine1: sourceOrg?.addressLine1 ?? (usePlaceholders ? '[Address Line]' : ''),
      transferringAddressLine2: sourceOrg?.addressLine2 ?? '',
      receivingEntityName: targetOrg?.name ?? (usePlaceholders ? '[Receiving Entity]' : ''),
      receivingAddressLine1: targetOrg?.addressLine1 ?? (usePlaceholders ? '[Address Line 1]' : ''),
      receivingAddressLine2: targetOrg?.addressLine2 ?? '',
      requisitionNumber: requisitionNumber ?? '[REQ-PENDING]',
      receiptDate: selectedDate ?? (usePlaceholders ? '[YYYYMMDD]' : new Date().toISOString().slice(0, 10).replaceAll('-', '')),
      items,
    };
  })
  .pipe(transferReceiptOutputSchema);