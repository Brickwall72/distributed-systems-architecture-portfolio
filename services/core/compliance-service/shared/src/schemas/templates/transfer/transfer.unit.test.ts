// File: services/core/compliance-service/shared/src/schemas/templates/transfer/transfer.unit.test.ts
import { TransferItemSchema, TransferPayloadSchema } from './transfer';

describe('TransferItemSchema', () => {
  const validItem = {
    itemNumber: 1,
    nomenclature: 'Tactical Radio Terminal',
    serialNumber: 'SN-884920',
    quantity: 2,
  };

  it('parses valid items and applies default unit "EA"', () => {
    const result = TransferItemSchema.safeParse(validItem);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unit).toBe('EA');
      expect(result.data.itemNumber).toBe(1);
    }
  });

  it('accepts string item numbers, explicit units, and optional notes', () => {
    const item = {
      ...validItem,
      itemNumber: 'ITEM-001A',
      unit: 'BOX',
      additionalNotes: 'Handle with care',
    };

    const result = TransferItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects non-positive quantities', () => {
    const zeroQuantityResult = TransferItemSchema.safeParse({ ...validItem, quantity: 0 });
    const negativeQuantityResult = TransferItemSchema.safeParse({ ...validItem, quantity: -5 });

    expect(zeroQuantityResult.success).toBe(false);
    expect(negativeQuantityResult.success).toBe(false);
  });

  it('rejects non-integer quantities', () => {
    const result = TransferItemSchema.safeParse({ ...validItem, quantity: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe('TransferPayloadSchema', () => {
  const validPayload = {
    releasingEntityName: 'Supply Depot Alpha',
    releasingAddressLine1: '100 Logistics Way',
    releasingAddressLine2: 'Building 4',
    receivingEntityName: 'Forward Operating Site Bravo',
    receivingAddressLine1: '200 Airfield Rd',
    receivingAddressLine2: 'Hangar 2',
    requisitionNumber: 'REQ-2026-1004-01',
    transferDate: '20261004',
    items: [
      {
        itemNumber: 1,
        nomenclature: 'Rugged Laptop',
        serialNumber: 'LT-90812',
        quantity: 1,
      },
    ],
  };

  it('validates a complete and compliant payload', () => {
    const result = TransferPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('enforces strict YYYYMMDD transfer date formatting', () => {
    const hyphenatedDate = TransferPayloadSchema.safeParse({
      ...validPayload,
      transferDate: '2026-10-04',
    });
    const invalidCharDate = TransferPayloadSchema.safeParse({
      ...validPayload,
      transferDate: '2026100A',
    });
    const shortDate = TransferPayloadSchema.safeParse({
      ...validPayload,
      transferDate: '2026104',
    });

    expect(hyphenatedDate.success).toBe(false);
    expect(invalidCharDate.success).toBe(false);
    expect(shortDate.success).toBe(false);
  });

  it('rejects payloads with empty items arrays', () => {
    const result = TransferPayloadSchema.safeParse({
      ...validPayload,
      items: [],
    });

    expect(result.success).toBe(false);
  });
});