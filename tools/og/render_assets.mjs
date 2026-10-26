// OGP 画像とアイコンを PNG にする
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [, , ogHtml, faviconSvg, outDir] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(ogHtml).href);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/og.png` });

  const svg = readFileSync(faviconSvg, 'utf-8');
  for (const size of [180, 192, 512]) {
    const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;background:#fff">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
    await p.screenshot({ path: `${outDir}/${name}`, omitBackground: false });
  }
} finally {
  await browser.close();
}
console.log('ok');
