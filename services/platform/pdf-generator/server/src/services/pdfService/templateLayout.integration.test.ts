// File: services/platform/pdf-generator/server/src/services/pdfService/templateLayout.integration.test.ts
// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generatePdfFromHtml } from './pdfService';

const templates = [
  'transfer-authorization.hbs',
  'transfer-receipt.hbs',
  'C2-authority-transfer.hbs',
];
const templateDirectory = new URL('../../../../../../core/compliance-service/server/src/registry/templates/', import.meta.url);

it('prints the signature and date lines at the physical authorization coordinates', async () => {
  const endpoint = process.env.PUPPETEER_BROWSER_WS_ENDPOINT;
  const browser = endpoint
    ? await puppeteer.connect({ browserWSEndpoint: endpoint })
    : await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  const launch = vi.spyOn(puppeteer, 'launch').mockResolvedValue(browser);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.emulateMediaType('print');
    for (const count of [1, 6, 12, 20, 40, 80]) {
      const lines: string[][] = [];
      for (const template of templates) {
        const source = await readFile(fileURLToPath(new URL(template, templateDirectory)), 'utf8');
        const html = source
          .replace(/{{#each items}}([\s\S]*?){{\/each}}/, (_match, row: string) => row.repeat(count))
          .replace(/{{[^}]+}}/g, 'Sample');
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        const clearance = await page.evaluate(() => {
          const label = document.querySelector('.signer-label');
          const line = document.querySelector('.sig-line');
          if (!label || !line) throw new Error('Signature label or line is missing');
          return line.getBoundingClientRect().left - label.getBoundingClientRect().right;
        });
        expect(clearance).toBeGreaterThan(0);
        const pdf = await PDFDocument.load(await generatePdfFromHtml(html));
        if (count <= 6) expect(pdf.getPageCount()).toBe(1);
        else expect(pdf.getPageCount()).toBeGreaterThan(1);
        const contents = pdf.getPage(pdf.getPageCount() - 1).node.Contents();
        const streams = contents instanceof PDFArray
          ? contents.asArray().map((ref) => pdf.context.lookup(ref))
          : [contents];
        const drawing = streams.map((stream) => {
          if (!(stream instanceof PDFRawStream)) throw new Error('Expected a raw PDF content stream');
          return Buffer.from(decodePDFRawStream(stream).decode()).toString('ascii');
        }).join('\n');
        const pageOffset = (pdf.getPageCount() - 1) * 1123;
        lines.push(drawing.split('\n')
          .filter((line) => /^\d+ \d+ (250|150) 1 re$/.test(line))
          .map((line) => line.replace(/^(\d+) (\d+)/, (_match, x: string, y: string) => `${x} ${Number(y) - pageOffset}`)));
      }
      expect(lines[0]).toEqual(['174 1071 250 1 re', '597 1071 150 1 re']);
      expect(lines[1]).toEqual(lines[0]);
      expect(lines[2]).toEqual(lines[0]);
    }
  } finally {
    launch.mockRestore();
    if (endpoint) await browser.disconnect();
    else await browser.close();
  }
}, 30000);
