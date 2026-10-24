// File: packages/contracts/common/src/cloudevent.ts
import { z } from 'zod';

export const createCloudEventSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    specversion: z.literal('1.0'),
    id: z.string(),
    source: z.string(),
    type: z.string(),
    time: z.string().datetime(),
    datacontenttype: z.literal('application/json'),
    correlationId: z.string().nullable().optional(),
    data: dataSchema,
  });

export type CloudEvent<T> = {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  time: string;
  datacontenttype: 'application/json';
  correlationId?: string | null;
  data: T;
};