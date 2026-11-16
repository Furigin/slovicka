// Скриншоты в мобильном вьюпорте 390×844 (iPhone 14/15) + сбор ошибок консоли.
// Запуск: npm run shots            (WebKit — движок Safari)
//         npm run shots -- chromium
// Результат: папка screenshots/ (в git не попадает).
import { webkit, chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startServer } from './serve.mjs';

const engine = process.argv[2] === 'chromium' ? chromium : webkit;
const only = process.argv[3];
mkdirSync('screenshots', { recursive: true });
const server = await startServer(8799);
const base = 'http://localhost:8799/';

const browser = await engine.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: engine !== webkit ? true : undefined,
  hasTouch: true, colorScheme: 'dark', locale: 'sk-SK',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `screenshots/${name}.png` });
  console.log('📷', name);
};
const go = async (hash) => { await page.goto(base + hash); await page.waitForTimeout(500); };

// Сценарии. Каждый — функция; можно запускать один: npm run shots -- webkit learn
const scenarios = {
  async tabs() {
    await go('#/learn'); await shot('01-learn');
    await go('#/dict'); await shot('02-dict');
    await go('#/stats'); await shot('03-stats');
    await go('#/settings'); await shot('04-settings');
  },
};

for (const [name, fn] of Object.entries(scenarios)) {
  if (only && only !== name) continue;
  try { await fn(); } catch (e) { errors.push(`[${name}] ${e.message}`); }
}

await browser.close();
server.close();
if (errors.length) { console.log('\nОШИБКИ:\n' + errors.join('\n')); process.exitCode = 1; }
else console.log('\nОшибок в консоли нет');
