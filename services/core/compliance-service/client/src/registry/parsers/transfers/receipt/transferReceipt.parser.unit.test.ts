import { parseTransferReceiptPayload } from './transferReceipt.parser';
import { OrganizationDTOSchema, AssetDTOSchema } from '@contracts/topology';
import { mockFromSchema } from '@shared/testing';

describe('parseReceiptPayload', () => {
  const mockOrg = mockFromSchema(OrganizationDTOSchema, {
    id: 'org_2',
    name: 'Bravo Depot',
    type: 'GOV_AGENCY',
    addressLine1: '456 Supply Rd',
    addressLine2: undefined,
  });

  const mockAsset = mockFromSchema(AssetDTOSchema, {
    id: 'ast_2',
    currentOwnerId: 'org_1',
    name: 'Night Vision Goggle',
    nomenclature: 'AN/PVS-14',
    serialNumber: 'SN-112233',
  });

  it('maps complete input data correctly without placeholders', () => {
    const result = parseTransferReceiptPayload({
      input: {
        sourceOrg: mockOrg,
        targetOrg: mockOrg,
        assets: [mockAsset],
        requisitionNumber: 'REQ-2026-888',
        selectedDate: '20261011',
      },
      usePlaceholders: false});

    expect(result).toEqual({
      transferringEntityName: 'Bravo Depot',
      transferringAddressLine1: '456 Supply Rd',
      transferringAddressLine2: '',
      receivingEntityName: 'Bravo Depot',
      receivingAddressLine1: '456 Supply Rd',
      receivingAddressLine2: '',
      requisitionNumber: 'REQ-2026-888',
      receiptDate: '20261011',
      items: [
        {
          itemNumber: 1,
          nomenclature: 'AN/PVS-14',
          serialNumber: 'SN-112233',
          additionalNotes: '',
          unit: 'EA',
          quantity: 1,
        },
      ],
    });
  });

  it('applies receipt fallback placeholders when usePlaceholders is true and fields are missing', () => {
    const result = parseTransferReceiptPayload({input: {}, usePlaceholders: true});

    expect(result.transferringEntityName).toBe('[Transferring Entity]');
    expect(result.receivingEntityName).toBe('[Receiving Entity]');
    expect(result.requisitionNumber).toBe('[REQ-PENDING]');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].nomenclature).toBe('[Received Asset Description Required]');
  });

  it('returns empty strings and empty items when usePlaceholders is false and fields are missing', () => {
    const result = parseTransferReceiptPayload({input: {}, usePlaceholders: false});

    expect(result.transferringEntityName).toBe('');
    expect(result.receivingEntityName).toBe('');
    expect(result.requisitionNumber).toBe('');
    expect(result.items).toEqual([]);
  });
});