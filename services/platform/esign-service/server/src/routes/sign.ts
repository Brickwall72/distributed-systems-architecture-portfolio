// File: services/platform/esignature-service/server/src/routes/sign.ts
import { Router, Request, Response } from 'express';
import { PDFDocument, rgb } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, createHealthCheck } from '@shared/telemetry';
import { getESignPublisher } from '../messaging/publisher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const esignRouter = Router();

const logger = createLogger('esignature-service');
esignRouter.get('/health', createHealthCheck('esign-server'));

esignRouter.post('/', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || null;

  try {
    logger.info('Received e-signature request.', correlationId);

    const {
      pdfBase64,
      signatureImageBase64,
      documentId,
      signerId,
      entityId,
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

    // 1. Load the PDF into pdf-lib for visual modifications
    let pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width } = firstPage.getSize();

    // 2. Convert base64 signature string to binary Buffer and embed it
    const signatureImageBytes = Buffer.from(signatureImageBase64, 'base64');
    const signatureImagePng = await pdfDoc.embedPng(signatureImageBytes);

    firstPage.drawImage(signatureImagePng, {
      x: width - 440,
      y: 35,
      width: 140,
      height: 40,
    });

    // 3. Generate the server-side signing timestamp
    const signingDateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    firstPage.drawText(signingDateStr, {
      x: width - 130,
      y: 45,
      size: 10,
      color: rgb(0, 0, 0),
    });

    // Save the visually updated PDF bytes
    pdfBuffer = Buffer.from(await pdfDoc.save());

    // 4. Apply cryptographic digital seal using @signpdf
    const certPath = path.resolve(__dirname, '../../certs/certificate.p12');
    if (fs.existsSync(certPath)) {
      logger.debug('Applying P12 cryptographic certificate seal.', correlationId);
      const p12Buffer = fs.readFileSync(certPath);
      const signer = new P12Signer(p12Buffer, {
        passphrase: process.env.CERT_PASSPHRASE || 'changeit',
      });
      const signPdf = new SignPdf();
      pdfBuffer = Buffer.from(await signPdf.sign(pdfBuffer, signer));
    } else {
      logger.warn('P12 certificate file not found; skipping cryptographic seal.', correlationId);
    }

    // 5. Dispatch CloudEvent over NATS JetStream
    const publisher = getESignPublisher();
    if (publisher) {
      await publisher.publishDocumentSigned({
        data: {
          documentId,
          signerId,
          entityId,
          status: 'SIGNED',
        },
        correlationId,
      });
      logger.info(`Published document.signed event for document ${documentId}`, correlationId);
    } else {
      logger.warn('NATS publisher unavailable; event publishing bypassed.', correlationId);
    }

    logger.info('Document successfully signed, sealed, and event emitted.', correlationId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="digitally-signed-document.pdf"');
    res.send(pdfBuffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown signing failure';
    logger.error(`E-Signature processing failed: ${message}`, correlationId);
    res.status(500).json({ error: `E-Signature processing failed: ${message}` });
  }
});