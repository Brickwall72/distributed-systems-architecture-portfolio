// File: packages/contracts/compliance/src/inputs/DocumentsTable.input.schema.ts
import { FormId } from './TemplateSelector.input.schema';
import { z } from 'zod';

export const DOCUMENT_STATUS = {
  SIGNED: 'SIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
  COMPLETED: 'COMPLETED',
} as const;
export const documentStatusEnum = z.enum(
  Object.values(DOCUMENT_STATUS) as [typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS], ...typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS][]]
);

export const documentsTableInputSchema = z.object({
  statusFilter: z.array(documentStatusEnum).optional(),
  requisitionNumbers: z.array(z.string()).optional(),
  hiddenColumns: z.array(z.enum(['type', 'transferType', 'status', 'updatedAt', 'requisitionNumber'])).optional(),
});
export type DocumentPreviewEvent =
  | { type: 'select'; documentId: string; identityId: string }
  | { type: 'ready'; documentId: string; identityId: string; blob: Blob }
  | { type: 'error'; documentId: string; identityId: string; message: string }
  | { type: 'clear' };

export type DocumentsTableInput = z.infer<typeof documentsTableInputSchema> & {
  readonly onTransferEventSelect?: (transferEventId: string | undefined) => void;
  readonly onRequisitionNumberSelect?: (requisitionNumber: string | undefined) => void;
  readonly onAuthorizingTemplateSelect?: (templateId: FormId | undefined) => void;
  readonly onPdfSelect?: (event: DocumentPreviewEvent) => void;
};