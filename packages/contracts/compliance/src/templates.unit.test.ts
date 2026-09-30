// File: packages/contracts/compliance/src/templates.unit.test.ts
import {
  DD1149TemplateDataSchema,
  TransferAuthorizationTemplateDataSchema,
} from './templates.js';

describe('Compliance Template Schemas', () => {
  const sampleItem = {
    itemNumber: 1,
    nomenclature: 'Tactical Radio Unit',
    serialNumber: 'TRU-88219-X',
  };

  describe('DD1149TemplateDataSchema', () => {
    const validDD1149Data = {
      releasingEntityName: 'HQ Supply Depot',
      receivingEntityName: 'Forward Operating Base Alpha',
      requisitionNumber: 'REQ-2026-0901',
      transferDate: '20260930',
      items: [sampleItem],
    };

    it('should parse valid DD-1149 template data and set default empty strings for address lines', () => {
      const result = DD1149TemplateDataSchema.parse(validDD1149Data);

      expect(result).toEqual({
        ...validDD1149Data,
        releasingAddressLine1: '',
        releasingAddressLine2: '',
        receivingAddressLine1: '',
        receivingAddressLine2: '',
        items: [
          {
            ...sampleItem,
            unit: 'EA',
            quantity: 1,
          },
        ],
      });
    });

    it('should retain explicit address lines when provided', () => {
      const input = {
        ...validDD1149Data,
        releasingAddressLine1: '100 Defense Way',
        receivingAddressLine1: 'Bldg 42 Sector 7',
      };

      const result = DD1149TemplateDataSchema.parse(input);
      expect(result.releasingAddressLine1).toBe('100 Defense Way');
      expect(result.receivingAddressLine1).toBe('Bldg 42 Sector 7');
    });

    it('should reject payload with empty items array', () => {
      const input = { ...validDD1149Data, items: [] };
      expect(() => DD1149TemplateDataSchema.parse(input)).toThrow(
        'At least one asset is required for transfer'
      );
    });

    it('should fail if required fields are missing', () => {
      const { requisitionNumber, ...invalidInput } = validDD1149Data;
      expect(() => DD1149TemplateDataSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('TransferAuthorizationTemplateDataSchema', () => {
    const validAuthData = {
      receivingEntityName: 'Logistics Battalion 4',
      releasingEntityName: 'Central Armory',
      authorizationCode: 'AUTH-99412-B',
      authorizationDate: '20260930',
      items: [sampleItem],
    };

    it('should parse valid Transfer Authorization data and apply address defaults', () => {
      const result = TransferAuthorizationTemplateDataSchema.parse(validAuthData);

      expect(result).toEqual({
        ...validAuthData,
        receivingAddressLine1: '',
        receivingAddressLine2: '',
        releasingAddressLine1: '',
        releasingAddressLine2: '',
        items: [
          {
            ...sampleItem,
            unit: 'EA',
            quantity: 1,
          },
        ],
      });
    });

    it('should reject payload when items array is empty', () => {
      const input = { ...validAuthData, items: [] };
      expect(() =>
        TransferAuthorizationTemplateDataSchema.parse(input)
      ).toThrow('At least one asset is required for transfer');
    });
  });
});