// File: services/platform/esignature-service/server/src/services/signing.unit.test.ts
import fs from 'node:fs/promises';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import { PDFDocument } from 'pdf-lib';
import { signDocument } from './signing.js';

// vi.hoisted guarantees mock variables are initialized before module factories run
const { mockFirstPage, mockPdfDoc, mockSign, mockLogger } = vi.hoisted(() => {
  const mockFirstPage = {
    getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
    drawImage: vi.fn(),
    drawText: vi.fn(),
  };

  const mockPdfDoc = {
    getPages: vi.fn().mockReturnValue([mockFirstPage]),
    embedPng: vi.fn().mockResolvedValue({ width: 140, height: 40 }),
    save: vi.fn().mockResolvedValue(new Uint8Array(Buffer.from('%PDF-1.7 Visual Elements Added'))),
  };

  const mockSign = vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7 Cryptographically Sealed'));

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return { mockFirstPage, mockPdfDoc, mockSign, mockLogger };
});

vi.mock('@shared/telemetry', () => ({
  createLogger: () => mockLogger,
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

vi.mock('@signpdf/placeholder-pdf-lib', () => ({
  pdflibAddPlaceholder: vi.fn(),
}));

// Use traditional function syntax to allow instantiation via `new`
vi.mock('@signpdf/signer-p12', () => ({
  P12Signer: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock('@signpdf/signpdf', () => ({
  SignPdf: vi.fn().mockImplementation(function () {
    return {
      sign: mockSign,
    };
  }),
}));

vi.mock('pdf-lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pdf-lib')>();
  return {
    ...actual,
    PDFDocument: {
      ...actual.PDFDocument,
      load: vi.fn().mockResolvedValue(mockPdfDoc),
    },
  };
});

describe('signDocument', () => {
  const validParams = {
    pdfBase64: Buffer.from('%PDF-1.7 Base Document').toString('base64'),
    signatureImageBase64:
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    correlationId: 'cid_sign_test_100',
  };

  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should successfully embed visual signature/date and apply cryptographic P12 seal', async () => {
    const fakeCertBuffer = Buffer.from('FAKE_P12_CERTIFICATE_CONTENT');
    vi.mocked(fs.readFile).mockResolvedValueOnce(fakeCertBuffer);

    const result = await signDocument(validParams);

    expect(result.signedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    expect(PDFDocument.load).toHaveBeenCalledTimes(1);
    expect(mockPdfDoc.embedPng).toHaveBeenCalledTimes(1);
    expect(mockFirstPage.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        x: 172,
        y: 35,
        width: 140,
        height: 40,
      })
    );
    expect(mockFirstPage.drawText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        x: 482,
        y: 45,
        size: 10,
      })
    );

    expect(pdflibAddPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfDoc: mockPdfDoc,
        reason: 'Digitally Signed Document',
        contactInfo: 'compliance@platform.local',
        name: 'eSignature Service',
        location: 'USA',
        signatureLength: 8192,
      })
    );
    expect(P12Signer).toHaveBeenCalledWith(fakeCertBuffer, { passphrase: 'changeit' });
    expect(SignPdf).toHaveBeenCalledTimes(1);
    expect(mockSign).toHaveBeenCalledTimes(1);

    expect(result.pdfBuffer.toString()).toBe('%PDF-1.7 Cryptographically Sealed');
  });

  it('should fall back gracefully to unsigned saved PDF if P12 certificate is missing or fails', async () => {
    vi.mocked(fs.readFile).mockRejectedValueOnce(
      new Error('ENOENT: no such file or directory')
    );

    const result = await signDocument(validParams);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('P12 certificate seal skipped (ENOENT: no such file or directory)'),
      'cid_sign_test_100'
    );

    expect(result.pdfBuffer.toString()).toBe('%PDF-1.7 Visual Elements Added');
    expect(SignPdf).not.toHaveBeenCalled();
  });

  it('should respect custom environment variables for cert path and signature metadata', async () => {
    process.env.SIGNING_CERT_PATH = '/custom/certs/prod.p12';
    process.env.SIGNING_CONTACT_INFO = 'secops@defense.gov';
    process.env.SIGNING_AUTHOR_NAME = 'HQ Armory Authority';
    process.env.SIGNING_LOCATION = 'US-EAST-1';
    process.env.CERT_PASSPHRASE = 'SecretPassphrase123!';

    const fakeCertBuffer = Buffer.from('PROD_P12_CERT');
    vi.mocked(fs.readFile).mockResolvedValueOnce(fakeCertBuffer);

    await signDocument(validParams);

    expect(fs.readFile).toHaveBeenCalledWith('/custom/certs/prod.p12');
    expect(pdflibAddPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({
        contactInfo: 'secops@defense.gov',
        name: 'HQ Armory Authority',
        location: 'US-EAST-1',
      })
    );
    expect(P12Signer).toHaveBeenCalledWith(fakeCertBuffer, {
      passphrase: 'SecretPassphrase123!',
    });
  });
});