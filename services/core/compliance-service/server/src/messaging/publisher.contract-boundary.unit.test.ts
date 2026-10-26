import { zocker } from 'zocker';
import { transferInitiatedDataSchema, transferReceivedDataSchema } from '@contracts/compliance';
import {
  publishtransferInitiatedDataSchema,
  publishTransferInitiatedInputSchema,
  publishtransferReceivedDataSchema,
  publishTransferReceivedInputSchema,
} from './publisher';

describe('compliance publisher: local data schemas vs shared event contracts', () => {
  it('transfer initiated: shared contract accepts every locally valid payload', () => {
    for (let i = 0; i < 25; i++) {
      const input = zocker(publishTransferInitiatedInputSchema).generate();
      const output = publishtransferInitiatedDataSchema.parse(input);
      const { createdAt, ...rest } = input;
      expect(output).toEqual({
        ...rest,
        date: createdAt,
      });
      expect(transferInitiatedDataSchema.safeParse(output).success).toBe(true);
    }
  });

  it('transfer received: transferId is mapped to the shared id for every locally valid payload', () => {
    for (let i = 0; i < 25; i++) {
      const input = zocker(publishTransferReceivedInputSchema).generate();
      const output = publishtransferReceivedDataSchema.parse(input);
      expect(output).toEqual({
        documentId: input.id,
        assetIds: input.assetIds,
        transferEventId: input.transferEventId,
        requisitionNumber: input.requisitionNumber,
      });
      expect(transferReceivedDataSchema.safeParse(output).success).toBe(true);
    }
  });

  it('transfer initiated: local and shared schemas declare the same keys', () => {
    const inputKeys = Object.keys(publishTransferInitiatedInputSchema.shape);
    expect(inputKeys).toContain('createdAt');
    expect(inputKeys).not.toContain('date');
    expect(publishTransferInitiatedInputSchema.shape.createdAt).toBeDefined();
    expect(transferInitiatedDataSchema.shape.date).toBeDefined();
  });

  it('transfer received: maps the local document id to the shared documentId', () => {
    const inputKeys = Object.keys(publishTransferReceivedInputSchema.shape);
    expect(inputKeys).toContain('id');
    expect(inputKeys).not.toContain('documentId');
    expect(transferReceivedDataSchema.shape.documentId).toBeDefined();
  });
});
