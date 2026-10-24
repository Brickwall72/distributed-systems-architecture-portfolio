// File: services/platform/esignature-service/server/src/services/signing/signing.ts
import { PDFDocument, rgb } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '@shared/express';
import { z } from 'zod';

export const signDocumentParamsSchema = z.object({
  pdfBuffer: z.instanceof(Buffer),
  signatureImageBase64: z.string(),
});

type signDocumentParams = z.infer<typeof signDocumentParamsSchema>;

const logger = createLogger('esign-server:signing');

export const signDocumentReturnSchema = z.object({
  pdfBuffer: z.instanceof(Buffer),
  signedAt: z.string(),
})

type SignDocumentReturn = z.infer<typeof signDocumentReturnSchema>

export async function signDocument({
  pdfBuffer,
  signatureImageBase64,
}: signDocumentParams): Promise<SignDocumentReturn> {
  // Capture UTC ISO timestamp for compliance contract and legal non-repudiation
  const now = new Date();
  const signedAt = now.toISOString();

  // 1. Load PDF into pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width } = firstPage.getSize();

  // 2. Embed signature PNG
  const signatureImageBytes = Buffer.from(signatureImageBase64, 'base64');
  const signatureImagePng = await pdfDoc.embedPng(signatureImageBytes);

  firstPage.drawImage(signatureImagePng, {
    x: width - 440,
    y: 35,
    width: 140,
    height: 40,
  });

  // 3. Draw human-readable signing date on document
  const signingDateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  });

  firstPage.drawText(signingDateStr, {
    x: width - 130,
    y: 45,
    size: 10,
    color: rgb(0, 0, 0),
  });

  // 4. Apply Cryptographic Digital Seal
  const certPath = process.env.SIGNING_CERT_PATH || path.resolve(process.cwd(), 'certs/certificate.p12');

  try {
    const p12Buffer = await fs.readFile(certPath);
    logger.debug('Applying P12 cryptographic certificate seal.');

    pdflibAddPlaceholder({
      pdfDoc,
      reason: 'Digitally Signed Document',
      contactInfo: process.env.SIGNING_CONTACT_INFO || 'compliance@platform.local',
      name: process.env.SIGNING_AUTHOR_NAME || 'eSignature Service',
      location: process.env.SIGNING_LOCATION || 'USA',
      signatureLength: 8192,
    });

    pdfBuffer = Buffer.from(await pdfDoc.save());

    const signer = new P12Signer(p12Buffer, {
      passphrase: process.env.CERT_PASSPHRASE || 'changeit',
    });
    const signPdf = new SignPdf();
    pdfBuffer = Buffer.from(await signPdf.sign(pdfBuffer, signer));
  } catch (err: unknown) {
    // If cert file does not exist or fails, fall back to unsigned PDF save
    pdfBuffer = Buffer.from(await pdfDoc.save());
    const msg = err instanceof Error ? err.message : 'File not found';
    logger.warn(`P12 certificate seal skipped (${msg}).`);
  }

  return { pdfBuffer, signedAt };
}