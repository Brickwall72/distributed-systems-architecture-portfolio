// File: services/platform/compliance/client/src/registry/parsers/transfers/authorization/transferAuthorization.parser.unittest.ts
import { parseTransferAuthorizationPayload } from './transferAuthorization.parser';
import { OrganizationDTO, AssetDTO } from '@contracts/topology';

describe('parseAuthorizationPayload', () => {
  const mockOrg: OrganizationDTO = {
    id: 'org_1',
    name: 'Alpha Logistics',
    type: 'GOV',
    addressLine1: '123 Depot St',
  };

  const mockAsset: AssetDTO = {
    id: 'ast_1',
    name: 'Radio',
    nomenclature: 'AN/PRC-152',
    serialNumber: 'SN-998877',
  };

  it('maps complete input data correctly without placeholders', () => {
    const result = parseTransferAuthorizationPayload({
      input: {
        sourceOrg: mockOrg,
        targetOrg: mockOrg,
        assets: [mockAsset],
        requisitionNumber: 'REQ-2026-999',
        selectedDate: '20261011',
      },
      usePlaceholders: false,
    });

    expect(result).toEqual({
      authorizingEntityName: 'Alpha Logistics',
      authorizingAddressLine1: '123 Depot St',
      authorizingAddressLine2: '',
      receivingEntityName: 'Alpha Logistics',
      receivingAddressLine1: '123 Depot St',
      receivingAddressLine2: '',
      requisitionNumber: 'REQ-2026-999',
      authorizationDate: '20261011',
      items: [
        {
          itemNumber: 1,
          nomenclature: 'AN/PRC-152',
          serialNumber: 'SN-998877',
          additionalNotes: '',
          unit: 'EA',
          quantity: 1,
        },
      ],
    });
  });

  it('applies fallback placeholders when usePlaceholders is true and fields are missing', () => {
    const result = parseTransferAuthorizationPayload({ input:{}, usePlaceholders: true });

    expect(result.authorizingEntityName).toBe('[Releasing Entity / Authorizing]');
    expect(result.requisitionNumber).toBe('[REQ-PENDING]');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].nomenclature).toBe('[Asset Description & Nomenclature Required]');
  });

  it('returns empty strings for missing fields when usePlaceholders is false', () => {
    const result = parseTransferAuthorizationPayload({ input:{}, usePlaceholders: false });

    expect(result.authorizingEntityName).toBe('');
    expect(result.requisitionNumber).toBe('');
    expect(result.items).toEqual([]);
  });
});