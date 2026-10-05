// File: services/platform/esignature-service/server/src/routes/sign.ts
import { Router, Request, Response } from 'express';
import { createLogger } from '@shared/telemetry';
import { getESignPublisher } from '../../messaging/publisher';
import { uploadSignedDocument, signDocument } from '../../services';

export const router = Router();
const logger = createLogger('esignature-service');

router.post('/', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || null;

  try {
    logger.info('Received e-signature request.', correlationId);

    const {
      pdfBase64,
      signatureImageBase64,
      documentId,
      documentType,
      signerId,
      entityId,
      customPath,
    } = req.body;

    // Boundary Validation
    if (!pdfBase64 || !signatureImageBase64) {
      logger.warn('Validation failed: Missing pdfBase64 or signatureImageBase64 payload.', correlationId);
      res.status(400).json({ error: 'Missing pdfBase64 or signatureImageBase64 payload.' });
      return;
    }

    if (!documentId || !signerId || !entityId) {
      logger.warn('Validation failed: Missing documentId, signerId, or entityId metadata.', correlationId);
      res.status(400).json({ error: 'Missing documentId, signerId, or entityId metadata required for event contract.' });
      return;
    }

    // 1. Execute cryptographic signing domain logic
    const { pdfBuffer, signedAt } = await signDocument({
      pdfBase64,
      signatureImageBase64,
      correlationId,
    });

    // 2. Persist to MinIO via Claim-Check Pattern
    logger.debug('Persisting signed document to Object Storage.', correlationId);
    const { s3Uri, bucket, key, fileHash, uploadedAt } = await uploadSignedDocument({
      pdfBuffer,
      entityId,
      documentId,
      customPath,
      correlationId,
    });

    // 3. Dispatch CloudEvent over NATS JetStream
    const publisher = getESignPublisher();
    if (publisher) {
      await publisher.publishDocumentSigned({
        data: {
          documentId,
          documentType,
          signerId,
          entityId,
          status: 'SIGNED',
          s3Uri,
          storageBucket: bucket,
          storageKey: key,
          fileHash,
          signedAt,
          uploadedAt,
        },
        correlationId,
      });
      logger.info(`Published document.signed event for document ${documentId}`, correlationId);
    } else {
      logger.warn('NATS publisher unavailable; event publishing bypassed.', correlationId);
    }

    logger.info('Document successfully signed, stored, and event emitted.', correlationId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="digitally-signed-document.pdf"');
    res.send(pdfBuffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown signing failure';
    logger.error(`E-Signature processing failed: ${message}`, correlationId);
    res.status(500).json({ error: `E-Signature processing failed: ${message}` });
  }
});