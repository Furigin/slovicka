// Проверка, что sw.js знает обо всех файлах и версия соответствует содержимому.
// Если упал — запусти `npm run sw` (иначе на iPhone не придёт обновление).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listAssets, assetsHash } from '../scripts/assets.mjs';

test('sw.js: список файлов и версия актуальны (npm run sw)', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const assets = listAssets();
  for (const a of assets) assert.ok(sw.includes(`'${a}'`), `нет в sw.js: ${a}`);
  assert.ok(sw.includes(`const VERSION = '${assetsHash(assets)}'`), 'версия устарела — запусти npm run sw');
});

test('в словацких текстах нет чешских букв (ř ů ě)', async () => {
  const { STRINGS } = await import('./helpers/i18n-strings.mjs');
  for (const [k, v] of Object.entries(STRINGS.sk)) assert.ok(!/[řůěŘŮĚ]/.test(v), `чешская буква в ${k}: ${v}`);
});
