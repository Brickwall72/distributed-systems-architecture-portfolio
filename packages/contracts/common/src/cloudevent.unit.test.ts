// File: packages/contracts/common/src/cloudevent.unit.test.ts
import { z } from 'zod';
import { createCloudEventSchema } from './cloudevent.js';

describe('createCloudEventSchema', () => {
  const dummyDataSchema = z.object({
    foo: z.string(),
    bar: z.number(),
  });

  const TestCloudEventSchema = createCloudEventSchema(dummyDataSchema);

  const validPayload = {
    specversion: '1.0' as const,
    id: 'evt_12345',
    source: 'service:test-service',
    type: 'com.system.test.event',
    time: '2026-09-30T12:00:00.000Z',
    datacontenttype: 'application/json' as const,
    correlationId: 'cid_98765',
    data: {
      foo: 'hello',
      bar: 42,
    },
  };

  it('should parse a fully populated valid CloudEvent envelope', () => {
    const parsed = TestCloudEventSchema.parse(validPayload);
    expect(parsed).toEqual(validPayload);
  });

  it('should accept correlationId when null or omitted', () => {
    const payloadWithNull = { ...validPayload, correlationId: null };
    expect(TestCloudEventSchema.parse(payloadWithNull).correlationId).toBeNull();

    const { correlationId, ...payloadWithoutCorrelationId } = validPayload;
    expect(
      TestCloudEventSchema.parse(payloadWithoutCorrelationId).correlationId
    ).toBeUndefined();
  });

  it('should reject invalid specversion', () => {
    const invalidPayload = { ...validPayload, specversion: '2.0' };
    expect(() => TestCloudEventSchema.parse(invalidPayload)).toThrow();
  });

  it('should reject non-JSON datacontenttype', () => {
    const invalidPayload = { ...validPayload, datacontenttype: 'text/plain' };
    expect(() => TestCloudEventSchema.parse(invalidPayload)).toThrow();
  });

  it('should reject non-ISO datetime strings in time', () => {
    const invalidPayload = { ...validPayload, time: '2026-09-30 12:00:00' };
    expect(() => TestCloudEventSchema.parse(invalidPayload)).toThrow();
  });

  it('should fail when inner data schema validation fails', () => {
    const invalidPayload = {
      ...validPayload,
      data: { foo: 'hello', bar: 'not-a-number' },
    };
    expect(() => TestCloudEventSchema.parse(invalidPayload)).toThrow();
  });
});