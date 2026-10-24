import { zocker } from 'zocker';
import { TransferInitiatedDataSchema, TransferReceivedDataSchema } from '@contracts/compliance';
import { complianceTransferInitiatedDataSchema, complianceTransferReceivedDataSchema } from './publisher';

describe('compliance publisher: local data schemas vs shared event contracts', () => {
  const cases = [
    ['transfer initiated', complianceTransferInitiatedDataSchema, TransferInitiatedDataSchema],
    ['transfer received', complianceTransferReceivedDataSchema, TransferReceivedDataSchema],
  ] as const;

  it.each(cases)('%s: shared contract accepts every locally valid payload', (_name, local, shared) => {
    for (let i = 0; i < 25; i++) {
      const result = shared.safeParse(zocker(local).generate());
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it.each(cases)('%s: local and shared schemas declare the same keys', (_name, local, shared) => {
    expect(Object.keys(local.shape).sort()).toEqual(Object.keys(shared.shape).sort());
  });
});
