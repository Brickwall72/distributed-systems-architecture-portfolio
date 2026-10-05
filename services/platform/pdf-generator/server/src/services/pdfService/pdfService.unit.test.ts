// File: services/platform/pdf-generator/server/src/services/pdfService/pdfService.unit.test.ts
import puppeteer from 'puppeteer';
import { generatePdfFromHtml } from './pdfService';

// Valid PDF buffer stub matching the header assertion (%PDF-)
const MOCK_PDF_BUFFER = Buffer.from('%PDF-1.7 Fake PDF content for unit test');

const mockPage = {
  setContent: vi.fn().mockResolvedValue(undefined),
  pdf: vi.fn().mockResolvedValue(MOCK_PDF_BUFFER),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  connected: true,
  newPage: vi.fn().mockResolvedValue(mockPage),
};

// Hoist Puppeteer mock before service imports
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

describe('pdfService (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as unknown as import('puppeteer').Browser);
  });

  it('should render HTML to a valid PDF Buffer without launching a real browser', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>LEO Constellation Report</title></head>
        <body><h1>Starlink-LEO-Mesh-4 Status</h1></body>
      </html>
    `;

    const buffer = await generatePdfFromHtml(mockHtml, 'test-correlation-id');

    // Assert output format and header
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');

    // Assert Puppeteer lifecycle methods
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
    expect(mockPage.setContent).toHaveBeenCalledWith(mockHtml, { waitUntil: 'domcontentloaded' });
    expect(mockPage.pdf).toHaveBeenCalledWith({ format: 'A4', printBackground: true });
    expect(mockPage.close).toHaveBeenCalledTimes(1);
  });

  it('should ensure page.close() is executed even if page.pdf fails', async () => {
    mockPage.pdf.mockRejectedValueOnce(new Error('Rendering engine failure'));

    await expect(generatePdfFromHtml('<div>fail</div>', 'err-id')).rejects.toThrow('Rendering engine failure');
    expect(mockPage.close).toHaveBeenCalledTimes(1);
  });
});