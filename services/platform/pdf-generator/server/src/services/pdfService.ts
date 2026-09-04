// File: services/platform/pdf-generator/server/src/services/pdfService.ts
import puppeteer, { Browser } from 'puppeteer';
import { createLogger } from '@shared/telemetry';

const logger = createLogger('pdf-generator-engine');
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance?.connected) {
    logger.info('Initializing new Puppeteer browser instance');
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }
  return browserInstance;
}

export async function generatePdfFromHtml(html: string, correlationId: string | null = null): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    logger.debug('Setting HTML content for PDF generation', correlationId);
    
    // Load the raw HTML directly into the headless browser
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    // Render the page to a PDF buffer
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true 
    });
    
    // Return Node Buffer (compatible with Express res.end)
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}