// File: services/platform/compliance/client/src/registry/parsers/transfers/authorization/transferAuthorization.parser.ts
import { ComplianceTemplateInput } from '../../../types';

export function parseTransferAuthorizationPayload(input: ComplianceTemplateInput, usePlaceholders = false) {
  const placeholderItems = usePlaceholders ? [{
    itemNumber: 1,
    nomenclature: '[Asset Description & Nomenclature Required]',
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
    authorizingEntityName: input.sourceOrg?.name ?? (usePlaceholders ? '[Releasing Entity / Authorizing]' : ''),
    authorizingAddressLine1: input.sourceOrg?.addressLine1 ?? (usePlaceholders ? '[Address Line 1]' : ''),
    authorizingAddressLine2: input.sourceOrg?.addressLine2 ?? '',
    
    receivingEntityName: input.targetOrg?.name ?? (usePlaceholders ? '[Receiving Entity / Destination]' : ''),
    receivingAddressLine1: input.targetOrg?.addressLine1 ?? (usePlaceholders ? '[Address Line 1]' : ''),
    receivingAddressLine2: input.targetOrg?.addressLine2 ?? '',

    requisitionNumber: input.requisitionNumber ?? (usePlaceholders ? '[REQ-PENDING]' : ''),
    authorizationDate: input.selectedDate ?? (usePlaceholders ? '[YYYYMMDD]' : new Date().toISOString().slice(0, 10).replaceAll('-', '')),
    
    items,
  };
}