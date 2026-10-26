// File: services/core/compliance-service/server/src/messaging/consumer.contract-boundary.unit.test.ts
import { zocker } from 'zocker';
import {
  transferEventCreatedDataSchema,
  transferEventUpdatedDataSchema,
  transferEventCompletedDataSchema,
} from '@contracts/topology';
import {
  updateForDocNumberDataSchema,
  updateForReqNumberDataSchema,
} from '../repositories';
import {
  handleTransferEventCreatedDataSchema,
  handleTransferEventUpdatedDataSchema,
  handleTransferEventCompletedDataSchema,
  handleTransferEventUpdatedInputSchema,
} from '../services';

describe('compliance consumer: topology event contracts to local service inputs', () => {
  it('maps created event data to an IN_PROGRESS requisition update', () => {
    for (let i = 0; i < 25; i++) {
      const data = zocker(transferEventCreatedDataSchema).generate();
      const result = handleTransferEventCreatedDataSchema.safeParse(data);

      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
      if (!result.success) continue;

      expect(result.data).toEqual({
        ...data,
        status: 'IN_PROGRESS',
      });
      expect(updateForReqNumberDataSchema.safeParse(result.data).success).toBe(true);
    }
  });

  it('maps updated event ids and statuses to the local document update input', () => {
    for (let i = 0; i < 25; i++) {
      const data = zocker(transferEventUpdatedDataSchema).generate();
      const result = handleTransferEventUpdatedDataSchema.safeParse(data);

      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
      if (!result.success) continue;

      expect(result.data).toEqual({
        transferEventId: data.transferEventId,
        status: data.transferEventStatus,
        id: data.documentId,
        ...(data.requisitionNumber === undefined ? {} : { requisitionNumber: data.requisitionNumber }),
      });
      expect(updateForDocNumberDataSchema.safeParse(result.data).success).toBe(true);
      expect(handleTransferEventUpdatedInputSchema.safeParse(result.data).success).toBe(true);
    }
  });

  it('maps completed event data to a COMPLETED requisition update', () => {
    for (let i = 0; i < 25; i++) {
      const data = zocker(transferEventCompletedDataSchema).generate();
      const result = handleTransferEventCompletedDataSchema.safeParse(data);

      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
      if (!result.success) continue;

      expect(result.data).toEqual({
        ...data,
        status: 'COMPLETED',
      });
      expect(updateForReqNumberDataSchema.safeParse(result.data).success).toBe(true);
    }
  });

  it('keeps required created/completed contract keys available to requisition updates', () => {
    const localKeys = Object.keys(updateForReqNumberDataSchema.shape);

    expect(localKeys).toContain('requisitionNumber');
    expect(localKeys).toContain('transferEventId');
    expect(localKeys).toContain('status');
    expect(Object.keys(transferEventCreatedDataSchema.shape)).toContain('requisitionNumber');
    expect(Object.keys(transferEventCompletedDataSchema.shape)).toContain('transferEventId');
  });

  it('maps the updated event identity and status fields to the document-update schema', () => {
    const localKeys = Object.keys(updateForDocNumberDataSchema.shape);
    const contractKeys = Object.keys(transferEventUpdatedDataSchema.shape);

    expect(localKeys).toEqual(['id', 'status']);
    expect(contractKeys).toContain('documentId');
    expect(contractKeys).toContain('transferEventStatus');
  });
});
