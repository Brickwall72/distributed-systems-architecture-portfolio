// File: services/core/topology-service/server/src/messaging/consumer.contract-boundary.unit.test.ts
import { zocker } from 'zocker';
import { transferInitiatedDataSchema, transferReceivedDataSchema } from '@contracts/compliance';
import {
  handletransferReceivedDataSchema,
  handleTransferReceivedInputsSchema,
  handleTransferInitiatedDataSchema,
} from '../services';
import { createTransferEventSchema, updateTransferEventSchema } from '../repositories';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('topology consumer: local param schemas vs shared compliance event contracts', () => {
  it('accepts globally valid initiated data and maps transferType to the repository type', () => {
    for (let i = 0; i < 25; i++) {
      const data = zocker(transferInitiatedDataSchema).generate();
      const result = handleTransferInitiatedDataSchema.safeParse(data);
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);

      if (result.success) {
        const { transferType, ...rest } = data;
        expect(result.data).toEqual({ ...rest, type: transferType });
        expect(createTransferEventSchema.safeParse(result.data).success).toBe(true);
      }
    }
  });

  it('maps transferEventId to the local id while preserving other received data', () => {
    for (let i = 0; i < 25; i++) {
      const data = zocker(transferReceivedDataSchema).generate();
      const result = handletransferReceivedDataSchema.safeParse(data);
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          id: data.transferEventId,
          assetIds: data.assetIds,
          documentId: data.documentId,
        });
        expect(handleTransferReceivedInputsSchema.safeParse(result.data).success).toBe(true);
      }
    }
  });

  it('keeps the initiated repository payload aligned with the shared event contract', () => {
    const globalKeys = Object.keys(transferInitiatedDataSchema.shape);
    const repositoryKeys = Object.keys(createTransferEventSchema.shape).map((key) =>
      key === 'type' ? 'transferType' : key,
    );

    expect(repositoryKeys.sort()).toEqual(globalKeys.sort());
  });

  it('keeps the received repository payload aligned with the shared event contract', () => {
    const localInputKeys = Object.keys(handleTransferReceivedInputsSchema.shape);
    const repositoryInputKeys = [...Object.keys(updateTransferEventSchema.shape), 'documentId'];
    expect(localInputKeys.sort()).toEqual(repositoryInputKeys.sort());
    expect(transferReceivedDataSchema.shape.transferEventId).toBeDefined();
  });
});