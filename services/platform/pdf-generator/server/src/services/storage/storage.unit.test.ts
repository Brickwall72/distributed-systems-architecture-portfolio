// File: services/platform/pdf-generator/server/src/services/storage/storage.unit.test.ts
import { zocker } from 'zocker';
import { uploadGeneratedDocumentRequestSchema, internalStorageClient } from './storage';
import { uploadFileRequestSchema } from '@shared/filestore';

describe('uploadGeneratedDocument Test Suite', () => {
  it('should successfully generate test data via zocker, validate schemas, and satisfy downstream contracts', () => {
    // Supply non-serializable runtime instances and binary buffers directly via zocker's chainable API
    const mockInput = zocker(uploadGeneratedDocumentRequestSchema)
      .supply(uploadGeneratedDocumentRequestSchema.shape.client, internalStorageClient)
      .supply(uploadGeneratedDocumentRequestSchema.shape.pdfBuffer, Buffer.from('%PDF-1.4 mock content'))
      .generate();

    // Simulate the downstream transformation
    const downstreamPayload = uploadFileRequestSchema.parse({
      ...mockInput,
      contentType: 'application/pdf',
    });

    // Verify downstream schema invariants
    expect(downstreamPayload.pdfBuffer).toBeInstanceOf(Buffer);
    expect(downstreamPayload.contentType).toEqual('application/pdf');
    expect(mockInput.client).toBeDefined();
  });
});