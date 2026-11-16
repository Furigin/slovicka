// Список файлов приложения для офлайн-кэша Service Worker.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT_FILES = ['index.html', 'manifest.webmanifest'];
const DIRS = ['css', 'js', 'vendor', 'fonts', 'icons', 'data'];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

export function listAssets() {
  const files = [...ROOT_FILES];
  for (const d of DIRS) {
    try { files.push(...walk(d)); } catch { /* папки может не быть */ }
  }
  return files.sort();
}

export function assetsHash(files) {
  const hash = createHash('sha256');
  for (const f of files) {
    hash.update(f);
    const buf = readFileSync(f);
    // текстовые файлы — без учёта CRLF/LF (Windows), бинарные — как есть
    hash.update(/\.(png|woff2|wasm)$/.test(f) ? buf : buf.toString('utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex').slice(0, 12);
}
