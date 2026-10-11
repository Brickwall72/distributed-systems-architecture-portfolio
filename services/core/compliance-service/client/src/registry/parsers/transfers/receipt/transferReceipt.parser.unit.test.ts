// File: services/platform/compliance/client/src/registry/parsers/transfers/receipt/transferReceipt.parser.unit.test.ts
import { parseTransferReceiptPayload } from './transferReceipt.parser';
import { OrganizationDTO, AssetDTO } from '@contracts/topology';

describe('parseReceiptPayload', () => {
  const mockOrg: OrganizationDTO = {
    id: 'org_2',
    name: 'Bravo Depot',
    type: 'MILITARY_BRANCH',
    addressLine1: '456 Supply Rd',
  };

  const mockAsset: AssetDTO = {
    id: 'ast_2',
    name: 'Night Vision Goggle',
    nomenclature: 'AN/PVS-14',
    serialNumber: 'SN-112233',
  };

  it('maps complete input data correctly without placeholders', () => {
    const result = parseTransferReceiptPayload({
      sourceOrg: mockOrg,
      targetOrg: mockOrg,
      assets: [mockAsset],
      requisitionNumber: 'REQ-2026-888',
      selectedDate: '20261011',
    }, false);

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
    const result = parseTransferReceiptPayload({}, true);

    expect(result.transferringEntityName).toBe('[Transferring Entity]');
    expect(result.receivingEntityName).toBe('[Receiving Entity]');
    expect(result.requisitionNumber).toBe('[REQ-PENDING]');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].nomenclature).toBe('[Received Asset Description Required]');
  });

  it('returns empty strings and empty items when usePlaceholders is false and fields are missing', () => {
    const result = parseTransferReceiptPayload({}, false);

    expect(result.transferringEntityName).toBe('');
    expect(result.receivingEntityName).toBe('');
    expect(result.requisitionNumber).toBe('');
    expect(result.items).toEqual([]);
  });
});