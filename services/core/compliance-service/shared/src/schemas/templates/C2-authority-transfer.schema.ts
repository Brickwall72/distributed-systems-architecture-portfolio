// File: services/core/compliance-service/server/src/registry/schemas/C2-authority-transfer.schema.ts
import { z } from 'zod';

export const c2AuthTransferAssetInputSchema = z.object({
  nomenclature: z.string(),
  serialNumber: z.string(),
  type: z.string().optional(),
});

export const c2AuthTransferOrgInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  addressLine1: z.string().optional(),
});

// requisitionNumber and selectedDate are now optional; absence triggers placeholder mode
export const c2AuthTransferInputSchema = z.object({
  requisitionNumber: z.string().optional(),
  selectedDate: z.string().optional(),
  sourceOrg: c2AuthTransferOrgInputSchema.optional(),
  targetOrg: c2AuthTransferOrgInputSchema.optional(),
  assets: z.array(c2AuthTransferAssetInputSchema).optional().default([]),
});

const c2AuthTransferOutputSchema = z.object({
  releasingCommandName: z.string(),
  releasingStationId: z.string(),
  releasingControlSegmentNode: z.string(),
  receivingCommandName: z.string(),
  receivingStationId: z.string(),
  receivingControlSegmentNode: z.string(),
  requisitionNumber: z.string(),
  authorizationTimestampUtc: z.string(),
  items: z.array(
    z.object({
      itemNumber: z.number(),
      nomenclature: z.string(),
      serialNumber: z.string(),
      additionalNotes: z.string(),
      telemetryChannel: z.string(),
    })
  ),
});

export const c2AuthTransferParserPipeline = c2AuthTransferInputSchema
  .transform(({ sourceOrg, targetOrg, requisitionNumber, selectedDate, assets }) => {
    // Automatically derive placeholder mode from data presence
    const usePlaceholders = !requisitionNumber;

    const placeholderItems = usePlaceholders ? [{
      itemNumber: 1,
      nomenclature: '[Remote Asset Designation & NORAD ID Required]',
      serialNumber: '[NORAD / Asset ID Required]',
      additionalNotes: '[Asset Type & Status]',
      telemetryChannel: '[TLM-CH-01]',
    }] : [];

    const items = assets.length > 0
      ? assets.map((asset, idx) => ({
          itemNumber: idx + 1,
          nomenclature: asset.nomenclature,
          serialNumber: asset.serialNumber,
          additionalNotes: `Type: ${asset.type ?? 'UNKNOWN'}`,
          telemetryChannel: `CH-${(asset.type ?? 'GENERAL').toUpperCase()}`,
        }))
      : placeholderItems;

    return {
      releasingCommandName: sourceOrg?.name ?? (usePlaceholders ? '[Releasing Command Name]' : ''),
      releasingStationId: sourceOrg?.id ?? (usePlaceholders ? '[Releasing Station ID]' : ''),
      releasingControlSegmentNode: sourceOrg?.addressLine1 ?? (usePlaceholders ? '[Control Segment Node]' : ''),
      receivingCommandName: targetOrg?.name ?? (usePlaceholders ? '[Receiving Command Name]' : ''),
      receivingStationId: targetOrg?.id ?? (usePlaceholders ? '[Receiving Station ID]' : ''),
      receivingControlSegmentNode: targetOrg?.addressLine1 ?? (usePlaceholders ? '[Control Segment Node]' : ''),
      requisitionNumber: requisitionNumber ?? '[REQ-PENDING]',
      authorizationTimestampUtc: selectedDate ?? (usePlaceholders ? '[YYYYMMDD]' : new Date().toISOString().slice(0, 10).replaceAll('-', '')),
      items,
    };
  })
  .pipe(c2AuthTransferOutputSchema);