// File: services/core/compliance-service/server/src/registry/schemas/transfer-authorization.schema.ts
import { z } from 'zod';

export const transferAuthAssetInputSchema = z.object({
  nomenclature: z.string(),
  serialNumber: z.string(),
});

export const transferAuthOrgInputSchema = z.object({
  name: z.string(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
});

export const transferAuthInputSchema = z.object({
  requisitionNumber: z.string().optional(),
  selectedDate: z.string().optional(),
  sourceOrg: transferAuthOrgInputSchema.optional(),
  targetOrg: transferAuthOrgInputSchema.optional(),
  assets: z.array(transferAuthAssetInputSchema).optional().default([]),
});

const transferAuthOutputSchema = z.object({
  authorizingEntityName: z.string(),
  authorizingAddressLine1: z.string(),
  authorizingAddressLine2: z.string(),
  receivingEntityName: z.string(),
  receivingAddressLine1: z.string(),
  receivingAddressLine2: z.string(),
  requisitionNumber: z.string().optional(),
  authorizationDate: z.string(),
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

export const transferAuthParserPipeline = transferAuthInputSchema
  .transform(({ sourceOrg, targetOrg, requisitionNumber, selectedDate, assets }) => {
    // Automatically derive placeholder mode from data presence
    const usePlaceholders = !requisitionNumber;

    const placeholderItems = usePlaceholders ? [{
      itemNumber: 1,
      nomenclature: '[Asset Description & Nomenclature Required]',
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
      authorizingEntityName: sourceOrg?.name ?? (usePlaceholders ? '[Releasing Entity / Authorizing]' : ''),
      authorizingAddressLine1: sourceOrg?.addressLine1 ?? (usePlaceholders ? '[Address Line]' : ''),
      authorizingAddressLine2: sourceOrg?.addressLine2 ?? '',
      receivingEntityName: targetOrg?.name ?? (usePlaceholders ? '[Receiving Entity / Destination]' : ''),
      receivingAddressLine1: targetOrg?.addressLine1 ?? (usePlaceholders ? '[Address Line]' : ''),
      receivingAddressLine2: targetOrg?.addressLine2 ?? '',
      requisitionNumber: requisitionNumber ?? '[REQ-PENDING]',
      authorizationDate: selectedDate ?? (usePlaceholders ? '[YYYYMMDD]' : new Date().toISOString().slice(0, 10).replaceAll('-', '')),
      items,
    };
  })
  .pipe(transferAuthOutputSchema);