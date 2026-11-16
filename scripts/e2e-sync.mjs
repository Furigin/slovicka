// Автотест синхронизации на локальном эмуляторе Firebase (без настоящего проекта).
// Запуск: npx firebase-tools emulators:exec --project demo-slovicka "node scripts/e2e-sync.mjs"
//
// Два «устройства» (отдельные браузерные контексты = отдельные IndexedDB):
//   A регистрируется, добавляет слово, синхронизирует → B входит и получает слово →
//   B меняет и удаляет → A получает изменения. Плюс проверка правил: чужие данные не читаются.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { startServer } from './serve.mjs';

const PORT = 8796;
const server = await startServer(PORT);
const browser = await chromium.launch();
const CONFIG = `export const firebaseConfig = { apiKey: 'demo-key', authDomain: 'demo-slovicka.firebaseapp.com', projectId: 'demo-slovicka', appId: 'demo', emulator: '127.0.0.1' };`;

async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/js/firebase-config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: CONFIG }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
  await page.goto(`http://localhost:${PORT}/#/settings`);
  await page.waitForSelector('text=Prihlásiť sa', { timeout: 15000 });
  return page;
}

const run = (page, fn, arg) => page.evaluate(fn, arg);
const syncNow = (page) => run(page, async () => (await import('./js/sync.js')).syncNow());
const noteSk = (page, id) => run(page, async (id) => (await (await import('./js/db.js')).get('notes', id))?.sk ?? null, id);

const email = `test${Date.now()}@example.com`;
let ok = 0;
const check = (cond, msg) => { assert.ok(cond, msg); ok++; console.log('✓', msg); };

try {
  // ---- Устройство A: регистрация, новое слово ----
  const A = await device('A');
  await A.fill('input[type=email]', email);
  await A.fill('input[type=password]', 'heslo123');
  await A.click('button:has-text("Vytvoriť účet")');
  await A.waitForSelector('text=Synchronizovať teraz', { timeout: 15000 });
  check(true, 'A: регистрация по email/паролю');

  await run(A, async () => {
    const store = await import('./js/store.js');
    await store.addNote({ id: 'n-test-1', sk: 'pätnásť', ru: 'пятнадцать (тест)', deckId: 'deck-moje-chyby' });
    await store.addNote({ id: 'n-test-2', sk: 'dom', ru: 'дом', deckId: 'deck-moje-chyby' });
  });
  const pushA = await syncNow(A);
  check(pushA.pushed > 0, `A: отправлено в облако (${pushA.pushed} записей)`);
  check(await run(A, async () => (await import('./js/db.js')).count('outbox')) === 0, 'A: outbox пуст после отправки');

  // ---- Устройство B: вход, получение ----
  const B = await device('B');
  await B.fill('input[type=email]', email);
  await B.fill('input[type=password]', 'heslo123');
  await B.click('button:has-text("Prihlásiť sa")');
  await B.waitForSelector('text=Synchronizovať teraz', { timeout: 15000 });
  await syncNow(B);
  check(await noteSk(B, 'n-test-1') === 'pätnásť', 'B: получил слово с диакритикой');
  const seedCount = await run(B, async () => (await (await import('./js/db.js')).getAll('decks')).length);
  check(seedCount === 2, `B: стартовые колоды не задвоились (${seedCount})`);

  // ---- B меняет и удаляет; A получает ----
  await run(B, async () => {
    const store = await import('./js/store.js');
    const n = await store.getNote('n-test-1');
    await store.updateNote({ ...n, sk: 'pätnásť!' });
    await store.deleteNotes(['n-test-2']);
  });
  await syncNow(B);
  const pullA = await syncNow(A);
  check(await noteSk(A, 'n-test-1') === 'pätnásť!', 'A: получил правку');
  check(await noteSk(A, 'n-test-2') === null, 'A: удаление дошло');
  check(pullA.pulled < 20, `A: при синхронизации прочитаны только изменения (${pullA.pulled})`);

  // ---- Повторная синхронизация без изменений — ничего не читаем ----
  const idle = await syncNow(A);
  check(idle.pulled === 0 && idle.pushed === 0, 'A: холостая синхронизация — 0 записей');

  // ---- Конфликт: обе стороны правят одно слово офлайн, побеждает более поздняя правка ----
  await run(A, async () => { const s = await import('./js/store.js'); const n = await s.getNote('n-test-1'); await s.updateNote({ ...n, ru: 'A' }); });
  await new Promise((r) => setTimeout(r, 30));
  await run(B, async () => { const s = await import('./js/store.js'); const n = await s.getNote('n-test-1'); await s.updateNote({ ...n, ru: 'B' }); });
  await syncNow(A); await syncNow(B); await syncNow(A);
  const ruA = await run(A, async () => (await (await import('./js/db.js')).get('notes', 'n-test-1')).ru);
  check(ruA === 'B', 'конфликт: побеждает более поздняя правка (B)');

  // ---- Правила: чужие данные не читаются ----
  const denied = await run(A, async () => {
    const fb = await import('./vendor/firebase.js');
    try {
      const { getFirestore, collection, getDocs } = fb;
      await getDocs(collection(getFirestore(), 'users', 'someone-else', 'items'));
      return false;
    } catch (e) { return e.code === 'permission-denied'; }
  });
  check(denied, 'правила: чужая коллекция недоступна');

  console.log(`\nВсе проверки синхронизации пройдены: ${ok}`);
} catch (e) {
  console.error('\nПРОВАЛ:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
