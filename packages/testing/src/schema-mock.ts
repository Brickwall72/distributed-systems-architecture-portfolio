import { z } from 'zod';
import { zocker } from 'zocker';

/** Pass `seed` for deterministic output (e.g. committed pact examples); omit it for fresh random data. */
export interface MockOptions {
  seed?: number;
}

/**
 * Generates schema-valid test data. Object schemas can't be auto-generated for fields
 * zocker doesn't support (e.g. `z.instanceof(Buffer)`), so supply those via `overrides`:
 * overridden keys are excluded from generation and merged back before the final parse.
 */
export function mockFromSchema<T extends z.ZodTypeAny>(
  schema: T,
  overrides: Partial<z.input<T>> = {},
  options: MockOptions = {},
): z.output<T> {
  const generate = (target: z.ZodTypeAny) => {
    const generator = zocker(target);
    return (options.seed === undefined ? generator : generator.setSeed(options.seed)).generate();
  };
  // typeName check instead of instanceof: consumers may resolve a different zod copy
  if ((schema._def as { typeName?: string }).typeName === 'ZodObject') {
    const objectSchema = schema as unknown as z.AnyZodObject;
    const mask = Object.fromEntries(Object.keys(overrides).map((key) => [key, true])) as Record<string, true>;
    const generated = generate(objectSchema.omit(mask));
    return objectSchema.parse({ ...(generated as object), ...overrides });
  }
  return schema.parse(generate(schema));
}

export const SHA256_HEX = 'a'.repeat(64);
