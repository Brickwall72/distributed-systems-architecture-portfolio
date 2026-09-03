// File: services/platform/pdf-generator/server/src/services/pdfService.ts
import puppeteer, { Browser } from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Recreate __dirname and __filename for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let browserInstance: Browser | null = null;

// Reusing browser instance across requests with optional chaining
async function getBrowser(): Promise<Browser> {
  if (!browserInstance?.connected) {
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

export async function generatePdfFromTemplate(templateName: string, data: Record<string, any>): Promise<Buffer> {
  // 1. Locate and read template
  const templatePath = path.join(__dirname, `../templates/${templateName}.hbs`);
  const templateSource = await fs.readFile(templatePath, 'utf-8');

  // 2. Inject JSON payload into Handlebars template
  const compiledTemplate = handlebars.compile(templateSource);
  const htmlContent = compiledTemplate(data);

  // 3. Render HTML in Puppeteer
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Fixed: Using 'domcontentloaded' to satisfy strict setContent types
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    // 4. Generate binary PDF buffer
    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    await page.close();
  }
}