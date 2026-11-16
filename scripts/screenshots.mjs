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
  async session() {
    await go('#/learn'); await shot('10-learn');
    // добавить слово через «+»
    await page.click('.fab'); await page.waitForTimeout(300);
    await page.fill('input[name=sk]', 'kniha');
    await page.fill('input[name=ru]', 'книга');
    await shot('11-add-word');
    await page.press('input[name=example]', 'Enter').catch(() => {});
    await page.locator('input[name=ru]').press('Enter');
    await page.locator('input[name=example]').press('Enter');
    await page.waitForTimeout(400); await shot('12-added');
    await page.keyboard.press('Escape');
    // Kartičky
    await go('#/session?mode=cards&deck=all'); await shot('13-card-front');
    await page.click('text=Ukázať odpoveď'); await shot('14-card-back');
    await page.click('.grade.g3'); await page.waitForTimeout(300);
    // Písanie
    await go('#/session?mode=typing&deck=all');
    await page.fill('.answer-input', 'patnast'); await page.press('.answer-input', 'Enter');
    await shot('15-typing-result');
    // Test
    await go('#/session?mode=test&deck=all'); await shot('16-test');
  },
  async import() {
    const file = process.env.USERPROFILE + '/Downloads/Slovakian_-_Russian_words_1319_items__-_.apkg';
    await go('#/import'); await shot('20-import');
    await page.setInputFiles('input[type=file]', file);
    await page.waitForSelector('text=Importovať', { timeout: 20000 });
    await page.waitForTimeout(500); await shot('21-import-preview');
    const t0 = Date.now();
    await page.click('button.big:has-text("Importovať")');
    await page.waitForURL(/#\/dict/, { timeout: 60000 });
    console.log(`   импорт занял ${Date.now() - t0} мс`);
    await page.waitForTimeout(800); await shot('22-dict-after-import');
    await page.click('.chip:has-text("Neaktívne")'); await page.waitForTimeout(400);
    await page.fill('input[type=search]', 'patnast'); await page.waitForTimeout(300);
    await shot('23-dict-search');
    await page.fill('input[type=search]', '');
    await page.click('button:has-text("Pridať 10 náhodných")'); await page.waitForTimeout(800);
    await go('#/learn'); await shot('24-learn-after');
  },
  async stats() {
    // искусственная история ответов за 3 месяца, чтобы увидеть графики
    await go('#/learn');
    await page.evaluate(async () => {
      const db = await import('./js/db.js');
      const now = Date.now(), DAY = 864e5, recs = [];
      for (let d = 0; d < 90; d++) {
        if (Math.random() < 0.25) continue;
        const n = Math.floor(Math.random() * 50) + 3;
        for (let i = 0; i < n; i++) recs.push({ id: `fake${d}-${i}`, ts: now - d * DAY - i * 6e4, cardId: 'x', grade: Math.random() < .8 ? 3 : 1,
          typeBefore: Math.random() < .2 ? 'new' : 'review', mode: Math.random() < .5 ? 'typing' : 'cards', ms: 8000, diacritic: Math.random() < (0.05 + d / 400) });
      }
      await db.put('reviews', recs, { keepTime: true });
      const cards = await db.getAll('cards');
      cards.forEach((c, i) => { c.type = 'review'; c.interval = i * 4; c.due = now + (i % 9) * DAY; });
      await db.put('cards', cards);
    });
    await go('#/stats'); await shot('30-stats');
    await page.evaluate(() => document.getElementById('view').scrollTo(0, 2000)); await shot('31-stats-bottom');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); await shot('32-stats-light');
  },
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
