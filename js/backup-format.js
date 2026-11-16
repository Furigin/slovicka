// Формат JSON-бэкапа (чистые функции, тесты: tests/backup.test.js).
//
// {
//   "app": "slovicka", "format": 1, "exportedAt": 1763312400000,
//   "stores": { "decks": [...], "notes": [...], "cards": [...], "reviews": [...],
//               "sessions": [...], "grammar": [...], "meta": [{ "key": "settings", ... }] },
//   "media": [{ "id": "...", "type": "image/png", "name": "bad.png", "data": "<base64>" }]
// }

export const BACKUP_STORES = ['decks', 'notes', 'cards', 'reviews', 'sessions', 'grammar', 'meta'];
export const FORMAT = 1;

export function buildBackup(stores, media = [], now = Date.now()) {
  const out = { app: 'slovicka', format: FORMAT, exportedAt: now, stores: {} };
  for (const s of BACKUP_STORES) out.stores[s] = stores[s] || [];
  // Синхронизируемые настройки — да, служебные ключи устройства (lastPull и т.п.) — нет
  out.stores.meta = out.stores.meta.filter((m) => m.key === 'settings');
  if (media.length) out.media = media;
  return out;
}

/** Проверка, что это наш бэкап. Возвращает текст ошибки или null. */
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object' || obj.app !== 'slovicka') return 'not-slovicka';
  if (typeof obj.format !== 'number' || obj.format > FORMAT) return 'format';
  if (!obj.stores || typeof obj.stores !== 'object') return 'stores';
  for (const s of BACKUP_STORES) if (obj.stores[s] && !Array.isArray(obj.stores[s])) return `store:${s}`;
  return null;
}

const keyOf = (store, r) => (store === 'meta' ? r.key : r.id);

/**
 * План восстановления.
 *   mode 'merge'   — берём запись из бэкапа, если её нет или она новее (updatedAt).
 *   mode 'replace' — всё из бэкапа; локальные записи, которых в бэкапе нет, удаляются.
 * → { put: {store: [...]}, del: {store: [ids]} }
 */
export function restorePlan(local, backup, mode = 'merge') {
  const plan = { put: {}, del: {} };
  for (const s of BACKUP_STORES) {
    const incoming = (backup.stores[s] || []).filter((r) => r && keyOf(s, r) !== undefined);
    const loc = new Map((local[s] || []).map((r) => [keyOf(s, r), r]));
    const inc = new Map(incoming.map((r) => [keyOf(s, r), r]));
    plan.put[s] = incoming.filter((r) => {
      if (mode === 'replace') return true;
      const l = loc.get(keyOf(s, r));
      return !l || (r.updatedAt || 0) > (l.updatedAt || 0);
    });
    plan.del[s] = mode === 'replace'
      ? [...loc.keys()].filter((k) => !inc.has(k) && !(s === 'meta' && k !== 'settings'))
      : [];
  }
  return plan;
}

// ---------- base64 для картинок ----------
export async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
