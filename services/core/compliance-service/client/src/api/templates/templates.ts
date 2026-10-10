// File: services/core/compliance-service/client/src/api/templates/templates.ts
import { z } from 'zod';
import {
  TemplateIdSchema,
  type TemplateId,
  TransferPayloadSchema,
  type TransferPayload,
} from 'compliance-shared';
import { getApiBaseUrl } from '../client-config';

export type TemplateDataMap = {
  'asset-transfer-authorization': TransferPayload;
  'asset-transfer-receipt': TransferPayload;
  'contract-test-bare': Record<string, unknown>;
};

export const COMPLIANCE_TEMPLATE_SCHEMAS: {
  [K in TemplateId]: z.ZodType<TemplateDataMap[K], z.ZodTypeDef, unknown>;
} = {
  'asset-transfer-authorization': TransferPayloadSchema,
  'asset-transfer-receipt': TransferPayloadSchema,
  'contract-test-bare': z.record(z.string(), z.unknown()),
};

export const TemplateManifestSchema = z.object({
  id: TemplateIdSchema,
  name: z.string().min(1),
});

export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;

export async function fetchTemplateManifest(): Promise<TemplateManifest[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/compliance/api/v1/templates`);

  if (!response.ok) {
    throw new Error(`Failed to fetch template manifest: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return z.array(TemplateManifestSchema).parse(data);
}

export async function fetchTemplateContent(id: string): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/compliance/api/v1/templates/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch template content for '${id}': ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Dynamically validates template input data against its registered contract schema.
 * Retains exact inferenced return types based on the passed TemplateId.
 */
export function validateTemplatePayload<K extends TemplateId>(
  templateId: K,
  data: unknown
): TemplateDataMap[K] {
  const schema = COMPLIANCE_TEMPLATE_SCHEMAS[templateId];
  if (!schema) {
    throw new Error(`No compliance validation schema registered for template ID '${templateId}'`);
  }
  return schema.parse(data);
}