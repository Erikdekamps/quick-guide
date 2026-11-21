// Makes icon.png (64 x 64, for Alt1's list of apps) from icon.svg, the app's icon.
// Run it after changing icon.svg: npm run icon
// It draws the picture in Chromium, the browser the tests and Alt1 use, so the two files look the same.
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const root = path.join(__dirname, '..');
const svg = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, 'icon.svg')).toString('base64');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
  await page.setContent('<!doctype html><style>html, body { margin: 0; background: transparent; } img { display: block; }</style>' +
    '<img src="' + svg + '" width="64" height="64" alt="">');
  await page.locator('img').evaluate((im) => im.decode());
  await page.screenshot({ path: path.join(root, 'icon.png'), omitBackground: true, clip: { x: 0, y: 0, width: 64, height: 64 } });
  await browser.close();
  console.log('icon.png made from icon.svg');
})();
