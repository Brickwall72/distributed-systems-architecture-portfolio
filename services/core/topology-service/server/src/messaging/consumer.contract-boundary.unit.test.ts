import { zocker } from 'zocker';
import { TransferInitiatedDataSchema, TransferReceivedDataSchema } from '@contracts/compliance';
import { handleTransferInitiatedParamsSchema, handleTransferReceivedParamsSchema } from '../repositories';

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('topology consumer: local param schemas vs shared compliance event contracts', () => {
  it('transfer initiated: local schema accepts every globally valid payload (transferType mapped to type)', () => {
    for (let i = 0; i < 25; i++) {
      const data = zocker(TransferInitiatedDataSchema).generate();
      const result = handleTransferInitiatedParamsSchema.safeParse({ ...data, type: data.transferType });
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it('transfer received: local schema accepts every globally valid payload', () => {
    for (let i = 0; i < 25; i++) {
      const result = handleTransferReceivedParamsSchema.safeParse(zocker(TransferReceivedDataSchema).generate());
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it('local required keys are a subset of the global keys (apart from the type mapping)', () => {
    const globalKeys = Object.keys(TransferInitiatedDataSchema.shape);
    const localKeys = Object.keys(handleTransferInitiatedParamsSchema.shape).map((k) => (k === 'type' ? 'transferType' : k));
    expect(localKeys.sort()).toEqual(globalKeys.sort());
    expect(Object.keys(handleTransferReceivedParamsSchema.shape).sort()).toEqual(
      Object.keys(TransferReceivedDataSchema.shape).sort(),
    );
  });
});
