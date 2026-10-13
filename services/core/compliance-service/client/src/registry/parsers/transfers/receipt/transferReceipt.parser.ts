// File: services/platform/compliance/client/src/registry/parsers/transfers/receipt/transferReceipt.parser.ts
import { ParserInput } from '../../../types';

export function parseTransferReceiptPayload({input, usePlaceholders}: ParserInput) {
  const placeholderItems = usePlaceholders ? [{
    itemNumber: 1,
    nomenclature: '[Received Asset Description Required]',
    serialNumber: '[Serial Number Required]',
    additionalNotes: '',
    unit: 'EA',
    quantity: 1,
  }] : [];

  const items = input.assets && input.assets.length > 0
    ? input.assets.map((asset, idx) => ({
        itemNumber: idx + 1,
        nomenclature: asset.nomenclature ?? asset.name,
        serialNumber: asset.serialNumber,
        additionalNotes: '',
        unit: 'EA',
        quantity: 1,
      }))
    : placeholderItems;

  return {
    transferringEntityName: input.sourceOrg?.name ?? (usePlaceholders ? '[Transferring Entity]' : ''),
    transferringAddressLine1: input.sourceOrg?.addressLine1 ?? (usePlaceholders ? '[Address Line 1]' : ''),
    transferringAddressLine2: input.sourceOrg?.addressLine2 ?? '',
    
    receivingEntityName: input.targetOrg?.name ?? (usePlaceholders ? '[Receiving Entity]' : ''),
    receivingAddressLine1: input.targetOrg?.addressLine1 ?? (usePlaceholders ? '[Address Line 1]' : ''),
    receivingAddressLine2: input.targetOrg?.addressLine2 ?? '',

    requisitionNumber: input.requisitionNumber ?? (usePlaceholders ? '[REQ-PENDING]' : ''),
    receiptDate: input.selectedDate ?? (usePlaceholders ? '[YYYYMMDD]' : new Date().toISOString().slice(0, 10).replaceAll('-', '')),
    
    items,
  };
}