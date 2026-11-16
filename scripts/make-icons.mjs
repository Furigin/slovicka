// Генерирует PNG-иконки приложения (рендер HTML в Chromium через Playwright).
// Запуск: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

mkdirSync('icons', { recursive: true });
const font = readFileSync('fonts/jetbrains-mono-latin-ext-700-normal.woff2').toString('base64');
const fontLatin = readFileSync('fonts/jetbrains-mono-latin-700-normal.woff2').toString('base64');

const html = (size, safe) => `<!doctype html><html><head><style>
@font-face { font-family: M; font-weight: 700; src: url(data:font/woff2;base64,${fontLatin}) format('woff2'); unicode-range: U+0000-00FF; }
@font-face { font-family: M; font-weight: 700; src: url(data:font/woff2;base64,${font}) format('woff2'); unicode-range: U+0100-02AF; }
html, body { margin: 0; width: ${size}px; height: ${size}px; }
body {
  background: radial-gradient(circle at 50% 45%, #2a2116 0%, #13110e 62%, #0c0a08 100%);
  display: grid; place-items: center; position: relative; overflow: hidden;
}
.g {
  font: 700 ${Math.round(size * (safe ? 0.42 : 0.52))}px/1 M;
  color: #f2b45c;
  text-shadow: 0 0 ${size * 0.04}px rgba(242,180,92,.75), 0 0 ${size * 0.12}px rgba(242,180,92,.35);
  letter-spacing: -0.04em;
  transform: translateY(-2%);
}
.g span { color: #f2b45c; opacity: .55; }
body::after {
  content: ''; position: absolute; inset: 0;
  background: repeating-linear-gradient(to bottom, rgba(0,0,0,.22) 0 ${Math.max(1, size / 180)}px, transparent 0 ${Math.max(3, size / 60)}px);
}
</style></head><body><div class="g">š<span>_</span></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, safe] of [
  ['apple-touch-icon.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size, safe));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `icons/${name}` });
}
await browser.close();
console.log('icons/ готовы');
