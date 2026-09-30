// File: services/platform/pdf-generator/server/.puppeteerrc.js
import os from 'node:os';

export default {
  executablePath: 
    process.env.PUPPETEER_EXECUTABLE_PATH || 
    (os.platform() === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/chromium-browser'),
};