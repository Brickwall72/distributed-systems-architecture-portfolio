#!/usr/bin/env node
// This destructive workflow is restricted to the disposable loopback test cluster.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';
let phase = 'checking the disposable cluster';

async function field(page, label) {
  await page.waitForFunction((text) => [...document.querySelectorAll('label')]
    .some((element) => element.textContent.trim() === text && document.getElementById(element.htmlFor)), {}, label);
  return page.evaluate((text) => {
    const element = [...document.querySelectorAll('label')].find((item) => item.textContent.trim() === text);
    return `[id="${CSS.escape(element.htmlFor)}"]`;
  }, label);
}

async function clickButton(page, text) {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')]
    .some((element) => element.textContent.trim() === label && !element.disabled), {}, text);
  const buttons = await page.$$('button');
  for (const button of buttons) {
    if (await button.evaluate((element) => element.textContent.trim()) === text) {
      await button.click();
      return;
    }
  }
  throw new Error(`Button not found: ${text}`);
}

async function pdfDownloads(page) {
  return page.evaluate(() => Promise.all(window.smokePdfs));
}

async function main() {
  if (process.argv[2] !== '--confirm-disposable-k3d') {
    throw new Error('Pass --confirm-disposable-k3d only for the disposable smoke cluster.');
  }
  const fixedPath = ['/usr/bin', '/bin'].join(path.delimiter);
  const ports = JSON.parse(execFileSync('/usr/bin/docker', [
    'inspect', 'k3d-dsap-funnel-smoke-serverlb', '--format', '{{json .NetworkSettings.Ports}}',
  ], { encoding: 'utf8', env: { ...process.env, PATH: fixedPath } }));
  if (!ports['80/tcp']?.some((binding) => binding.HostIp === '127.0.0.1' && binding.HostPort === '8081')) {
    throw new Error('The disposable k3d ingress is not bound to loopback port 8081.');
  }
  if (!process.env.CHROME_BIN) throw new Error('CHROME_BIN must identify the installed Chromium browser.');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    phase = 'opening the demo';
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.evaluateOnNewDocument(() => {
      const originalFetch = window.fetch;
      window.smokePdfs = [];
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (response.url.startsWith('http://minio.localhost:8081/') && response.status === 200
            && response.headers.get('content-type')?.includes('application/pdf')) {
          window.smokePdfs.push(response.clone().arrayBuffer().then((buffer) => ({
            length: buffer.byteLength,
            valid: new TextDecoder().decode(buffer.slice(0, 5)) === '%PDF-',
          }), () => ({ length: 0, valid: false })));
        }
        return response;
      };
    });
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'networkidle2', timeout: 120000 });
    phase = 'selecting the demo identity';
    const identity = await field(page, 'Signed in as');
    await page.waitForFunction((selector) => Boolean(document.querySelector(selector)?.querySelector(
      'option[value="usr_reaction_engines"]')), {}, identity);
    await page.select(identity, 'usr_reaction_engines');
    phase = 'opening transfers';
    await clickButton(page, 'Transfers');
    phase = 'selecting the test asset';
    const asset = await field(page, 'Asset for Transfer');
    await page.click(asset);
    await page.waitForFunction(() => [...document.querySelectorAll('[role="option"]')]
      .some((element) => element.textContent.includes('KSP-ENG-06')));
    const options = await page.$$('[role="option"]');
    const selected = await Promise.all(options.map((item) => item.evaluate(
      (element) => element.textContent.includes('KSP-ENG-06'),
    )));
    if (!selected.includes(true)) throw new Error('Fictional test asset is unavailable.');
    await options[selected.indexOf(true)].click();
    phase = 'selecting the destination';
    const target = await field(page, 'Target Organization');
    await page.waitForFunction((selector) => Boolean(document.querySelector(selector)?.querySelector(
      'option[value="org-ksc-gov"]')), {}, target);
    await page.select(target, 'org-ksc-gov');
    phase = 'selecting the template';
    const template = await field(page, 'Compliance Form');
    await page.waitForFunction((selector) => Boolean(document.querySelector(selector)?.querySelector(
      'option[value="asset-transfer-authorization"]')), {}, template);
    await page.select(template, 'asset-transfer-authorization');
    phase = 'generating the PDF';
    await clickButton(page, 'Authorize Transfer');
    await clickButton(page, 'Sign Authorization');
    const draftDownloads = await pdfDownloads(page);
    if (!draftDownloads.some((pdf) => pdf.valid)) {
      throw new Error('The generated PDF is missing or invalid.');
    }
    phase = 'signing the PDF';
    const canvas = await page.waitForSelector('canvas', { visible: true });
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Signature canvas is unavailable.');
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 60, { steps: 5 });
    await page.mouse.up();
    await clickButton(page, 'Submit & Sign PDF');
    phase = 'waiting for the topology update';
    await page.waitForFunction(() => document.body.textContent.includes('Signed document saved; topology update applied.'));
    const downloads = await pdfDownloads(page);
    if (!downloads.slice(draftDownloads.length).some((pdf) => pdf.valid)) {
      throw new Error('The signed PDF is missing or invalid.');
    }
    console.log('Fictional transfer, signature, PDF downloads and topology update passed.');
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(`Browser smoke test failed while ${phase}: ${error.message.replace(/https?:\/\/\S+/gi, '[URL]')}`);
  process.exitCode = 1;
}
