import { describe, it, expect, expectTypeOf } from 'vitest';
import { zocker } from 'zocker';
import { generatePdfCommandSchema as globalSchema, type GeneratePdfCommand } from '@contracts/pdf';
import { generatePdfCommandSchema as localSchema } from './responder';
import type { z } from 'zod';

describe('pdf responder: local schema vs shared messaging contract', () => {
  it('accepts every payload the shared contract allows', () => {
    for (let i = 0; i < 25; i++) {
      const globalPayload = zocker(globalSchema).generate();
      expect(localSchema.safeParse(globalPayload).success).toBe(true);
    }
  });

  it('does not require fields the shared contract does not guarantee', () => {
    const globalKeys = new Set(Object.keys(globalSchema.shape));
    const requiredLocal = Object.entries(localSchema.shape)
      .filter(([, field]) => !field.isOptional())
      .map(([key]) => key);

    expect(requiredLocal.filter((key) => !globalKeys.has(key))).toEqual([]);
    for (const key of requiredLocal) {
      expect(globalSchema.shape[key as keyof typeof globalSchema.shape].isOptional()).toBe(false);
    }
  });

  it('types the shared command as assignable to the local input', () => {
    expectTypeOf<GeneratePdfCommand>().toMatchTypeOf<z.input<typeof localSchema>>();
  });
});
