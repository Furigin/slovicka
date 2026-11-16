// Обновляет в sw.js список файлов для офлайн-кэша и версию (хеш содержимого).
// Запускать после любой правки файлов приложения: `npm run sw`.
// Если забыть — тест tests/sw.test.js упадёт и напомнит.
import { readFileSync, writeFileSync } from 'node:fs';
import { listAssets, assetsHash } from './assets.mjs';

const assets = listAssets();
const version = assetsHash(assets);
const sw = readFileSync('sw.js', 'utf8');
const block = `// <assets>\nconst VERSION = '${version}';\nconst ASSETS = [\n${
  ['./', ...assets].map((a) => `  '${a}',`).join('\n')}\n];\n// </assets>`;
const next = sw.replace(/\/\/ <assets>[\s\S]*?\/\/ <\/assets>/, block);
writeFileSync('sw.js', next);
console.log(`sw.js: ${assets.length} файлов, версия ${version}`);
