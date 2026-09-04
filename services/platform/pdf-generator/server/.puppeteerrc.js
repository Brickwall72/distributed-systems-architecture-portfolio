// File: services/platform/pdf-generator/server/.puppeteerrc.js

/**
 * @type {import('puppeteer').Configuration}
 */
export default {
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
};