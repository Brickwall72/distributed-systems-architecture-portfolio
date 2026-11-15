// File: services/platform/esign-service/server/src/messaging/responder.integration.test.ts
// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { EventBroker } from '@shared/messaging';
import { ObjectStorageClient } from '@shared/filestore';
import { mockFromSchema } from '@shared/testing';
import { ESIGN_COMMAND_SUBJECTS, SignDocumentCommandSchema, SignDocumentResponseSchema } from '@contracts/esign';

it('signs and retries a compliance draft using separate scoped storage accounts', async () => {
  const endpoint = process.env.MINIO_TEST_ENDPOINT;
  if (!endpoint) throw new Error('MINIO_TEST_ENDPOINT must point to an isolated MinIO instance');
  const settings = {
    S3_ENDPOINT: endpoint, S3_PUBLIC_ENDPOINT: endpoint, S3_ACCESS_KEY: 'esign-test',
    S3_SECRET_KEY: 'esign-test-password', DOCUMENT_BUCKET: 'dsap',
    SIGNING_CERT_PATH: path.resolve(process.cwd(), 'certs/certificate.p12'), SIGNING_CERT_PASSWORD: 'changeit',
  };
  const previous = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const pdfBuffer = Buffer.from(await pdf.save());
    const documentId = `esign-${randomUUID()}`;
    const storageKey = `compliance/drafts/${documentId}.pdf`;
    const pdfStorage = new ObjectStorageClient({
      endpoint, region: 'us-east-1', accessKeyId: 'pdf-test', secretAccessKey: 'pdf-test-password', forcePathStyle: true,
    });
    await pdfStorage.uploadFile({ storageBucket: 'dsap', storageKey, contentType: 'application/pdf', metadata: {}, pdfBuffer });

    let handler: ((payload: unknown) => Promise<unknown>) | undefined;
    const broker = {
      respond: vi.fn((subject: string, callback: (payload: unknown) => Promise<unknown>) => {
        if (subject === ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT) handler = callback;
      }),
    } as unknown as EventBroker;
    const { registerESignResponder } = await import('./responder');
    registerESignResponder(broker);
    if (!handler) throw new Error('Signing handler was not registered');
    const command = mockFromSchema(SignDocumentCommandSchema, {
      documentId, documentType: 'AUTHORIZATION', storageBucket: 'dsap', storageKey,
      customPath: 'compliance/transfers/AUTHORIZATION',
      documentName: 'Fictional authorization', requisitionNumber: 'REQ-TEST-1',
      signerId: 'integration-signer', jobId: 'integration-job',
      fileHash: createHash('sha256').update(pdfBuffer).digest('hex'),
      signatureImageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=',
    });
    const first = SignDocumentResponseSchema.parse(await handler(command));
    const retry = SignDocumentResponseSchema.parse(await handler(command));
    expect(retry).toEqual(first);
    expect(first.storageKey).toBe(`compliance/transfers/AUTHORIZATION/${documentId}.pdf`);
    const response = await fetch(first.presignedUrl);
    expect(response.status).toBe(200);
    const signed = Buffer.from(await response.arrayBuffer());
    expect(createHash('sha256').update(signed).digest('hex')).toBe(first.fileHash);
    expect(signed.toString('latin1')).toContain('/ByteRange');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}, 30000);
