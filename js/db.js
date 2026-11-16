// Хранилище: IndexedDB через маленькую обёртку idb (vendor/idb.js).
//
// Хранилища (stores):
//   decks     — колоды (balíčky)
//   notes     — слова: { sk, ru, example, deckId, active, img }
//   cards     — карточки SRS: по 2 на слово (ru2sk / sk2ru) + карточки грамматики
//   reviews   — журнал ответов (для статистики)
//   sessions  — завершённые сессии (для серии дней)
//   grammar   — правки/добавления таблиц спряжения и склонения
//   media     — картинки из .apkg (Blob). НЕ синхронизируются с облаком.
//   meta      — настройки и служебные значения
//   outbox    — очередь изменений для отправки в Firebase
//
// Любое изменение через put()/del() автоматически попадает в outbox,
// а sync.js потом отправляет outbox в Firestore.

import { openDB as idbOpen } from '../vendor/idb.js';

export const DB_NAME = 'slovicka';
export const DB_VERSION = 1;

/** Хранилища, которые синхронизируются с облаком. */
export const SYNCED_STORES = ['decks', 'notes', 'cards', 'reviews', 'sessions', 'grammar', 'meta'];
/** Ключи meta, которые синхронизируются (остальные — локальные для устройства). */
export const SYNCED_META_KEYS = ['settings'];

let dbPromise = null;

export function openDB() {
  if (!dbPromise) {
    dbPromise = idbOpen(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('decks', { keyPath: 'id' });
          const notes = db.createObjectStore('notes', { keyPath: 'id' });
          notes.createIndex('deckId', 'deckId');
          const cards = db.createObjectStore('cards', { keyPath: 'id' });
          cards.createIndex('noteId', 'noteId');
          cards.createIndex('due', 'due');
          const reviews = db.createObjectStore('reviews', { keyPath: 'id' });
          reviews.createIndex('ts', 'ts');
          reviews.createIndex('cardId', 'cardId');
          db.createObjectStore('sessions', { keyPath: 'id' });
          db.createObjectStore('grammar', { keyPath: 'id' });
          db.createObjectStore('media', { keyPath: 'id' });
          db.createObjectStore('meta', { keyPath: 'key' });
          db.createObjectStore('outbox', { keyPath: 'key' });
        }
        // Будущие миграции: if (oldVersion < 2) { ... }
      },
      blocked() { console.warn('IndexedDB: обновление заблокировано другой вкладкой'); },
    });
  }
  return dbPromise;
}

const keyOf = (store, rec) => (store === 'meta' ? rec.key : rec.id);

function shouldSync(store, rec) {
  if (!SYNCED_STORES.includes(store)) return false;
  if (store === 'meta') return SYNCED_META_KEYS.includes(rec.key);
  return true;
}

// ---------- Чтение ----------
export async function get(store, id) { return (await openDB()).get(store, id); }
export async function getAll(store) { return (await openDB()).getAll(store); }
export async function count(store) { return (await openDB()).count(store); }
export async function getAllByIndex(store, index, value) {
  return (await openDB()).getAllFromIndex(store, index, value);
}
export async function getRange(store, index, lower, upper) {
  const range = IDBKeyRange.bound(lower, upper);
  return (await openDB()).getAllFromIndex(store, index, range);
}

// ---------- Запись ----------
/**
 * Сохранить одну или несколько записей. Проставляет updatedAt и кладёт в outbox.
 * opts.keepTime — не трогать updatedAt (импорт бэкапа).
 * opts.local — не синхронизировать (служебные данные устройства).
 */
export async function put(store, recs, opts = {}) {
  const list = Array.isArray(recs) ? recs : [recs];
  if (!list.length) return;
  const db = await openDB();
  const tx = db.transaction([store, 'outbox'], 'readwrite');
  const now = Date.now();
  for (const rec of list) {
    if (!opts.keepTime || !rec.updatedAt) rec.updatedAt = now;
    tx.objectStore(store).put(rec);
    if (!opts.local && shouldSync(store, rec)) {
      const id = keyOf(store, rec);
      tx.objectStore('outbox').put({ key: `${store}~${id}`, store, id, deleted: false, at: now });
    }
  }
  await tx.done;
}

/** Удалить записи по id (с «надгробием» в outbox, чтобы удалилось и в облаке). */
export async function del(store, ids, opts = {}) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length) return;
  const db = await openDB();
  const tx = db.transaction([store, 'outbox'], 'readwrite');
  const now = Date.now();
  for (const id of list) {
    tx.objectStore(store).delete(id);
    if (!opts.local && SYNCED_STORES.includes(store)) {
      tx.objectStore('outbox').put({ key: `${store}~${id}`, store, id, deleted: true, at: now });
    }
  }
  await tx.done;
}

/** Применить изменения, пришедшие из облака (без записи в outbox). Last-writer-wins по updatedAt. */
export async function applyRemote(items) {
  if (!items.length) return 0;
  const db = await openDB();
  const stores = [...new Set(items.map((i) => i.store))];
  const tx = db.transaction([...stores, 'outbox'], 'readwrite');
  let applied = 0;
  for (const it of items) {
    const os = tx.objectStore(it.store);
    const local = await os.get(it.id);
    const pending = await tx.objectStore('outbox').get(`${it.store}~${it.id}`);
    // Локальная правка новее и ещё не отправлена — она победит при следующей отправке.
    if (pending && local && (local.updatedAt || 0) > (it.updatedAt || 0)) continue;
    if (it.deleted) { if (local) { await os.delete(it.id); applied++; } continue; }
    if (local && (local.updatedAt || 0) >= (it.updatedAt || 0)) continue;
    await os.put(it.data);
    applied++;
  }
  await tx.done;
  return applied;
}

// ---------- meta (настройки и служебные значения) ----------
export async function getMeta(key, fallback = undefined) {
  const rec = await get('meta', key);
  return rec ? rec.value : fallback;
}
export async function setMeta(key, value) {
  await put('meta', { key, value }, { local: !SYNCED_META_KEYS.includes(key) });
}

// ---------- outbox ----------
export async function outboxAll() { return getAll('outbox'); }
/** Удалить из outbox отправленные записи (если после отправки их не меняли снова). */
export async function outboxAck(entries) {
  const db = await openDB();
  const tx = db.transaction('outbox', 'readwrite');
  for (const e of entries) {
    const cur = await tx.store.get(e.key);
    if (cur && cur.at === e.at) await tx.store.delete(e.key);
  }
  await tx.done;
}

/** Полная очистка (для «заменить всё» при импорте бэкапа). */
export async function clearAll({ keepMedia = false } = {}) {
  const db = await openDB();
  const names = [...db.objectStoreNames].filter((n) => !(keepMedia && n === 'media'));
  const tx = db.transaction(names, 'readwrite');
  for (const n of names) tx.objectStore(n).clear();
  await tx.done;
}

/** Попросить браузер не удалять данные (iOS может чистить данные сайтов). */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

export async function storageEstimate() {
  try { return await navigator.storage.estimate(); } catch { return null; }
}
