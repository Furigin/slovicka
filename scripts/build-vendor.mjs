// Копирует зависимости из node_modules в vendor/ и fonts/ (чтобы всё работало офлайн и без CDN).
// Запускать только при обновлении библиотек: `npm run vendor`. Результат коммитится в репо,
// поэтому для деплоя на GitHub Pages никакая сборка не нужна.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const nm = (p) => `node_modules/${p}`;
mkdirSync('vendor', { recursive: true });
mkdirSync('fonts', { recursive: true });

// idb — маленькая обёртка над IndexedDB (ES-модуль без зависимостей)
cpSync(nm('idb/build/index.js'), 'vendor/idb.js');
// fzstd — декодер zstd (нужен для новых .apkg с collection.anki21b)
cpSync(nm('fzstd/esm/index.mjs'), 'vendor/fzstd.js');
// JSZip — распаковка .apkg (UMD, подключается тегом <script> по требованию)
cpSync(nm('jszip/dist/jszip.min.js'), 'vendor/jszip.min.js');
// sql.js — SQLite в WebAssembly (браузерная сборка)
cpSync(nm('sql.js/dist/sql-wasm-browser.js'), 'vendor/sql-wasm.js');
cpSync(nm('sql.js/dist/sql-wasm-browser.wasm'), 'vendor/sql-wasm.wasm');

// Firebase: собираем в один ES-модуль только нужные функции (auth + firestore/lite).
writeFileSync('scripts/.firebase-entry.js', `
export { initializeApp } from 'firebase/app';
export { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
export { getFirestore, collection, doc, getDocs, query, where, orderBy, limit,
  writeBatch, serverTimestamp, Timestamp, startAfter } from 'firebase/firestore/lite';
`);
await build({
  entryPoints: ['scripts/.firebase-entry.js'],
  bundle: true, format: 'esm', minify: true, target: 'es2020',
  outfile: 'vendor/firebase.js', legalComments: 'none',
});

// Шрифты: JetBrains Mono (интерфейс) и Inter (слова на карточках).
// Подмножества latin + latin-ext (словацкая диакритика) + cyrillic.
for (const [pkg, name, weights] of [
  ['@fontsource/jetbrains-mono', 'jetbrains-mono', [400, 700]],
  ['@fontsource/inter', 'inter', [400, 600]],
]) {
  for (const w of weights) for (const sub of ['latin', 'latin-ext', 'cyrillic']) {
    const f = `${name}-${sub}-${w}-normal.woff2`;
    cpSync(nm(`${pkg}/files/${f}`), `fonts/${f}`);
  }
}
console.log('vendor/ и fonts/ обновлены');
