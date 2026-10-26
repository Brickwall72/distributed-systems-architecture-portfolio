// File: services/core/topology-service/server/src/messaging/publisher.contract-boundary.unit.test.ts
import { zocker } from 'zocker';
import {
  transferEventCreatedDataSchema,
  transferEventUpdatedDataSchema,
  transferEventCompletedDataSchema,
} from '@contracts/topology';
import {
  publishTransferEventCreatedDataSchema,
  publishTransferEventCreatedInputSchema,
  publishTransferEventUpdatedDataSchema,
  publishTransferEventUpdatedInputSchema,
  publishTransferEventCompletedDataSchema,
  publishTransferEventCompletedInputSchema,
} from './publisher';

describe('topology publisher boundary schemas', () => {
  it('maps the local created event id to the topology contract transferEventId', () => {
    for (let i = 0; i < 25; i++) {
      const input = zocker(publishTransferEventCreatedInputSchema).generate();
      const output = publishTransferEventCreatedDataSchema.parse(input);

      expect(output).toEqual({
        requisitionNumber: input.requisitionNumber,
        transferEventId: input.id,
      });
      expect(transferEventCreatedDataSchema.safeParse(output).success).toBe(true);
    }
  });

  it('maps local status and id fields to the updated topology contract', () => {
    for (let i = 0; i < 25; i++) {
      const input = zocker(publishTransferEventUpdatedInputSchema).generate();
      const output = publishTransferEventUpdatedDataSchema.parse(input);

      expect(output).toEqual({
        requisitionNumber: input.requisitionNumber,
        documentId: input.documentId,
        transferEventId: input.id,
        transferEventStatus: input.status,
      });
      expect(transferEventUpdatedDataSchema.safeParse(output).success).toBe(true);
    }
  });

  it('maps the local completed event id to the topology contract transferEventId', () => {
    for (let i = 0; i < 25; i++) {
      const input = zocker(publishTransferEventCompletedInputSchema).generate();
      const output = publishTransferEventCompletedDataSchema.parse(input);

      expect(output).toEqual({
        requisitionNumber: input.requisitionNumber,
        transferEventId: input.id,
      });
      expect(transferEventCompletedDataSchema.safeParse(output).success).toBe(true);
    }
  });
});
