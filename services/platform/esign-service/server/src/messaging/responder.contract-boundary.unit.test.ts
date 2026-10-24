import { describe, it, expect, expectTypeOf } from 'vitest';
import { zocker } from 'zocker';
import { SignDocumentCommandSchema, SignDocumentResponseSchema, type SignDocumentCommand } from '@contracts/esign';
import { signDocumentCommandSchema as localSchema } from './responder';
import type { z } from 'zod';

describe('esign responder: local schema vs shared messaging contract', () => {
  it('accepts every payload the shared contract allows', () => {
    for (let i = 0; i < 25; i++) {
      const globalPayload = zocker(SignDocumentCommandSchema).generate();
      const result = localSchema.safeParse(globalPayload);
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it('does not require fields the shared contract does not guarantee', () => {
    const requiredLocal = Object.entries(localSchema.shape)
      .filter(([, field]) => !field.isOptional())
      .map(([key]) => key);
    const globalShape = SignDocumentCommandSchema.shape as Record<string, { isOptional(): boolean }>;

    for (const key of requiredLocal) {
      expect(globalShape[key], `shared contract is missing "${key}"`).toBeDefined();
      expect(globalShape[key].isOptional(), `"${key}" is optional in the shared contract`).toBe(false);
    }
  });

  it('types the shared command as assignable to the local input', () => {
    expectTypeOf<SignDocumentCommand>().toMatchTypeOf<z.input<typeof localSchema>>();
  });

  it('shared response schema requires the artifact fields the service produces', () => {
    expect(Object.keys(SignDocumentResponseSchema.shape)).toEqual(
      expect.arrayContaining(['storageBucket', 'storageKey', 'presignedUrl', 'success', 'signedAt', 'uploadedAt']),
    );
  });
});
