// File: services/core/audit-ledger/server/src/messaging/consumer.contract-boundary.unit.test.ts
import { zocker } from 'zocker';
import { transferInitiatedEventSchema, TransferReceivedEventSchema } from '@contracts/compliance';
import {
  transferEventCreatedEventSchema,
  transferEventUpdatedEventSchema,
  transferEventCompletedEventSchema,
} from '@contracts/topology';
import {
  handleTransferCreatedSchema,
  handleTransferUpdatedSchema,
  handleTransferCompletedSchema,
  handleTransferInitiatedSchema,
  handleTransferReceivedSchema,
} from '../services';

const RUNS = 25;

describe('audit consumer: published event contracts to ledger entry-point inputs', () => {
  const cases = [
    ['topology created', transferEventCreatedEventSchema, handleTransferCreatedSchema],
    ['topology completed', transferEventCompletedEventSchema, handleTransferCompletedSchema],
    ['compliance initiated', transferInitiatedEventSchema, handleTransferInitiatedSchema],
    ['compliance received', TransferReceivedEventSchema, handleTransferReceivedSchema],
  ] as const;

  it.each(cases)('accepts every generated %s event and splits envelope from data', (_name, wire, entry) => {
    for (let i = 0; i < RUNS; i++) {
      const event = zocker(wire as unknown as typeof transferEventCreatedEventSchema).generate() as unknown as { id: string; type: string; source: string; time: string; data: unknown };
      const result = (entry as never as typeof handleTransferCreatedSchema).safeParse(event);

      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
      if (!result.success) continue;
      expect(result.data.meta).toMatchObject({ eventId: event.id, eventType: event.type, source: event.source, occurredAt: event.time });
      expect(result.data.data).toEqual(event.data);
    }
  });

  it('accepts updated events that carry a requisitionNumber and rejects those without', () => {
    for (let i = 0; i < RUNS; i++) {
      const event = zocker(transferEventUpdatedEventSchema).generate();
      const withReq = { ...event, data: { ...event.data, requisitionNumber: 'REQ-1' } };
      const withoutReq = { ...event, data: { ...event.data, requisitionNumber: undefined } };

      expect(handleTransferUpdatedSchema.safeParse(withReq).success).toBe(true);
      expect(handleTransferUpdatedSchema.safeParse(withoutReq).success).toBe(false);
    }
  });

  it('rejects payloads that are not CloudEvents', () => {
    expect(handleTransferCompletedSchema.safeParse({ data: {} }).success).toBe(false);
  });
});
