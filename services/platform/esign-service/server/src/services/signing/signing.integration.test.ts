// File: services/platform/esign-service/server/src/services/signing/signing.integration.test.ts
// @vitest-environment node
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import { signDocument } from './signing';

const execFile = promisify(execFileCallback);

it('applies a verifiable cryptographic seal to a PDF using a real certificate', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'esign-test-'));
  const key = path.join(dir, 'key.pem');
  const certificate = path.join(dir, 'certificate.pem');
  const p12 = path.join(dir, 'certificate.p12');
  const signatureFile = path.join(dir, 'signature.der');
  const contentFile = path.join(dir, 'content.bin');
  const outputFile = path.join(dir, 'verified.bin');
  const previousPath = process.env.SIGNING_CERT_PATH;
  const previousPassword = process.env.SIGNING_CERT_PASSWORD;
  try {
    await execFile('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', key, '-out', certificate, '-subj', '/CN=Integration Test', '-days', '1']);
    await execFile('openssl', ['pkcs12', '-export', '-inkey', key, '-in', certificate,
      '-out', p12, '-passout', 'pass:integration-test']);
    process.env.SIGNING_CERT_PATH = p12;
    process.env.SIGNING_CERT_PASSWORD = 'integration-test';
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=';
    const result = await signDocument({ pdfBuffer: Buffer.from(await pdf.save()), signatureImageBase64: image });
    const bytes = result.pdfBuffer;
    const range = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(bytes.toString('latin1'));
    if (!range) throw new Error('Signed PDF has no byte range');
    const [, firstStart, firstLength, secondStart, secondLength] = range.map(Number);
    const signedContent = Buffer.concat([
      bytes.subarray(firstStart, firstStart + firstLength),
      bytes.subarray(secondStart, secondStart + secondLength),
    ]);
    const signatureHex = bytes.subarray(firstLength, secondStart).toString('ascii').match(/<([0-9A-Fa-f]+)>/)?.[1];
    if (!signatureHex) throw new Error('Signed PDF has no CMS signature');
    await writeFile(signatureFile, Buffer.from(signatureHex, 'hex'));
    await writeFile(contentFile, signedContent);
    await execFile('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', signatureFile,
      '-content', contentFile, '-noverify', '-out', outputFile]);
    expect(await readFile(outputFile)).toEqual(signedContent);
  } finally {
    if (previousPath === undefined) delete process.env.SIGNING_CERT_PATH;
    else process.env.SIGNING_CERT_PATH = previousPath;
    if (previousPassword === undefined) delete process.env.SIGNING_CERT_PASSWORD;
    else process.env.SIGNING_CERT_PASSWORD = previousPassword;
    for (const file of [key, certificate, p12, signatureFile, contentFile, outputFile]) {
      await rm(file, { force: true });
    }
    await rmdir(dir);
  }
}, 30000);
