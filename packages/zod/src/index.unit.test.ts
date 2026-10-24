import { z } from 'zod';
import { omitSchemaKeys } from './index';

describe('omitSchemaKeys', () => {
  const target = z.object({ a: z.string(), b: z.number(), c: z.boolean() });
  const source = z.object({ b: z.number(), x: z.string() });

  it('removes keys present in the source schema from the target', () => {
    const result = omitSchemaKeys(target, source);
    expect(Object.keys(result.shape)).toEqual(['a', 'c']);
  });

  it('does not mutate the target schema', () => {
    omitSchemaKeys(target, source);
    expect(Object.keys(target.shape)).toEqual(['a', 'b', 'c']);
  });

  it('produces a schema that parses objects without the omitted keys', () => {
    const result = omitSchemaKeys(target, source);
    expect(result.parse({ a: 'x', c: true })).toEqual({ a: 'x', c: true });
  });
});
