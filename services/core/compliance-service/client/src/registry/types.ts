// File: services/platform/compliance/client/src/registry/types.ts
import { ComplianceWorkflowWidgetProps } from '@contracts/compliance';

export interface ComplianceTemplateInput extends ComplianceWorkflowWidgetProps {
  requisitionNumber?: string;
  selectedDate?: string;
}

export interface ParserInput {
  input: ComplianceTemplateInput,
  usePlaceholders?: boolean
}