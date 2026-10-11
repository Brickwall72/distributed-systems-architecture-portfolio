// File: services/platform/compliance/client/src/registry/resolveTemplateData.ts
import { TemplateId } from 'compliance-shared';
import { parseTransferAuthorizationPayload, parseTransferReceiptPayload } from './parsers';
import { ComplianceTemplateInput } from './types';

type ParserFn = (input: ComplianceTemplateInput, usePlaceholders?: boolean) => Record<string, unknown>;

const TEMPLATE_PARSERS: Record<TemplateId, ParserFn> = {
  'asset-transfer-authorization': parseTransferAuthorizationPayload,
  'asset-transfer-receipt': parseTransferReceiptPayload,
  'contract-test-bare': (input, usePlaceholders) => ({
    requisitionNumber: input.requisitionNumber ?? (usePlaceholders ? '[TEST-REQ]' : ''),
    items: [],
  }),
};

export function generateTemplatePayload(
  templateId: TemplateId,
  input: ComplianceTemplateInput,
  usePlaceholders = false
): Record<string, unknown> {
  const parser = TEMPLATE_PARSERS[templateId];

  if (!parser) {
    return {
      requisitionNumber: usePlaceholders ? '[REQ-PENDING]' : '',
      items: [],
    };
  }

  return parser(input, usePlaceholders);
}