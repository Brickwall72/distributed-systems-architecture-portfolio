// File: packages/contracts/common/src/primitives.unit.test.ts
import { describe, it, expect } from 'vitest';
import { TransferItemSchema } from './primitives.js';

describe('TransferItemSchema', () => {
  it('should parse a complete valid transfer item', () => {
    const input = {
      itemNumber: 1,
      nomenclature: 'Ruggedized Laptop',
      serialNumber: 'SN-99812-X',
      additionalNotes: 'Handle with care',
      unit: 'BOX',
      quantity: 5,
    };

    const parsed = TransferItemSchema.parse(input);
    expect(parsed).toEqual(input);
  });

  it('should populate default values for unit and quantity when omitted', () => {
    const minimalInput = {
      itemNumber: 2,
      nomenclature: 'Monitors',
      serialNumber: 'SN-10029-Y',
    };

    const parsed = TransferItemSchema.parse(minimalInput);

    expect(parsed).toEqual({
      ...minimalInput,
      unit: 'EA',
      quantity: 1,
    });
  });

  it('should fail validation when required fields are missing', () => {
    const missingNomenclature = {
      itemNumber: 1,
      serialNumber: 'SN-001',
    };

    expect(() => TransferItemSchema.parse(missingNomenclature)).toThrow();
  });

  it('should fail validation when field types are incorrect', () => {
    const invalidTypes = {
      itemNumber: 'one', // string instead of number
      nomenclature: 'Desk',
      serialNumber: 12345, // number instead of string
    };

    expect(() => TransferItemSchema.parse(invalidTypes)).toThrow();
  });
});