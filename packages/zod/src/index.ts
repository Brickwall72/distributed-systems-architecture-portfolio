// File: packages/zod/src/index.ts
import { z } from 'zod';

/**
 * Type-safe helper that omits keys from a target schema based on a source schema's shape 
 * without triggering Zod's strict Exactly generic constraints.
 */
export function omitSchemaKeys<
  TTargetShape extends z.ZodRawShape,
  TSourceShape extends z.ZodRawShape
>(
  targetSchema: z.ZodObject<TTargetShape>,
  sourceSchema: z.ZodObject<TSourceShape>
): z.ZodObject<Omit<TTargetShape, keyof TSourceShape>> {
  // Clone the target shape
  const newShape = { ...targetSchema.shape };

  // Remove keys present in the source shape
  for (const key of Object.keys(sourceSchema.shape)) {
    delete newShape[key as keyof typeof newShape];
  }

  // Return a new Zod object with precise Omit shape typing
  return z.object(newShape as Omit<TTargetShape, keyof TSourceShape>);
}