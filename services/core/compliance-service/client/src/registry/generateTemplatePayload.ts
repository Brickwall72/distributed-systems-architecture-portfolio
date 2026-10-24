// File: services/platform/compliance/client/src/registry/resolveTemplateData.ts
import { FormName } from 'compliance-shared';
import { parseTransferAuthorizationPayload, parseTransferReceiptPayload } from './parsers';
import { ParserInput } from './types';


type ParserFn = (input: ParserInput) => Record<string, unknown>;

const TEMPLATE_PARSERS: Record<FormName, ParserFn> = {
  'asset-transfer-authorization': parseTransferAuthorizationPayload,
  'asset-transfer-receipt': parseTransferReceiptPayload,
  'contract-test-bare': ({input, usePlaceholders}) => ({
    requisitionNumber: input.requisitionNumber ?? (usePlaceholders ? '[TEST-REQ]' : ''),
    items: [],
  }),
};

export interface PayloadParams extends ParserInput {
  templateId?: FormName,
  usePlaceholders?: boolean
}

export function generateTemplatePayload({templateId, input, usePlaceholders = true}: PayloadParams): Record<string, unknown> {
  const parser = templateId ? TEMPLATE_PARSERS[templateId] : undefined;

  if (!parser) {
    return {
      requisitionNumber: usePlaceholders ? '[REQ-PENDING]' : '',
      items: [],
    };
  }

  return parser({input, usePlaceholders});
}