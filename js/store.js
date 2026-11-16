// Операции с колодами, словами и карточками поверх db.js.
// Экраны работают только через этот модуль, а не напрямую с IndexedDB.

import * as db from './db.js';
import { newCardState } from './srs.js';
import { searchKey } from './textutil.js';
import { uid } from './dom.js';
import { dayStart } from './days.js';

export const DIRS = ['ru2sk', 'sk2ru'];
export const SEED_DECKS = {
  chyby: 'deck-moje-chyby',
  slovnik: 'deck-slovnik',
};

// ---------- Колоды ----------
export async function listDecks() {
  const decks = await db.getAll('decks');
  return decks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'sk'));
}

export async function saveDeck(deck) {
  const d = { directions: { ru2sk: true, sk2ru: true }, createdAt: Date.now(), ...deck };
  if (!d.id) d.id = uid('deck-');
  await db.put('decks', d);
  return d;
}

export async function deleteDeck(id) {
  const notes = await db.getAllByIndex('notes', 'deckId', id);
  await deleteNotes(notes.map((n) => n.id));
  await db.del('decks', id);
}

// ---------- Слова (notes) ----------
export async function listNotes() { return db.getAll('notes'); }
export async function getNote(id) { return db.get('notes', id); }

/** Создать слово. active=false — только в словаре, без карточек. */
export async function addNote({ sk, ru, example = '', deckId, active = true, img = null, source = 'manual', id }) {
  const now = Date.now();
  const note = {
    id: id || uid('n-'),
    sk: sk.trim(), ru: ru.trim(), example: (example || '').trim(),
    deckId, active, img, source, createdAt: now,
  };
  await db.put('notes', note);
  if (active) await ensureCards([note]);
  return note;
}

export async function updateNote(note) {
  await db.put('notes', note);
  // колода могла смениться — обновляем копию deckId в карточках
  const cards = await db.getAllByIndex('cards', 'noteId', note.id);
  const changed = cards.filter((c) => c.deckId !== note.deckId);
  changed.forEach((c) => { c.deckId = note.deckId; });
  if (changed.length) await db.put('cards', changed);
  if (note.active) await ensureCards([note]);
}

export async function deleteNotes(ids) {
  if (!ids.length) return;
  const cardIds = [];
  for (const id of ids) {
    const cards = await db.getAllByIndex('cards', 'noteId', id);
    cardIds.push(...cards.map((c) => c.id));
  }
  await db.del('cards', cardIds);
  await db.del('notes', ids);
}

/** Создать недостающие карточки (RU→SK и SK→RU) для слов. */
export async function ensureCards(notes) {
  const existing = new Set((await db.getAll('cards')).map((c) => c.id));
  const toAdd = [];
  for (const n of notes) {
    for (const dir of DIRS) {
      const id = `${n.id}:${dir}`;
      if (existing.has(id)) continue;
      toAdd.push({
        ...newCardState(), id, noteId: n.id, deckId: n.deckId, dir, kind: 'vocab',
        suspended: false, order: n.order ?? n.createdAt ?? Date.now(), createdAt: Date.now(),
      });
    }
  }
  await db.put('cards', toAdd);
  return toAdd.length;
}

/** Добавить слова из словаря в обучение. */
export async function activateNotes(ids) {
  const notes = (await Promise.all(ids.map((id) => db.get('notes', id)))).filter(Boolean);
  const now = Date.now();
  notes.forEach((n, i) => { n.active = true; n.order = now + i; });
  await db.put('notes', notes);
  await ensureCards(notes);
  return notes.length;
}

/** Приостановить / вернуть все карточки слова. */
export async function setNoteSuspended(noteId, suspended) {
  const cards = await db.getAllByIndex('cards', 'noteId', noteId);
  cards.forEach((c) => { c.suspended = suspended; });
  await db.put('cards', cards);
}

export async function setCardSuspended(cardId, suspended) {
  const c = await db.get('cards', cardId);
  if (!c) return;
  c.suspended = suspended;
  await db.put('cards', c);
}

/** Поиск дубля по словацкому + русскому (без учёта диакритики и регистра). */
export async function findDuplicate(sk, ru, exceptId = null) {
  const ks = searchKey(sk), kr = searchKey(ru);
  return (await db.getAll('notes')).find((n) => n.id !== exceptId && searchKey(n.sk) === ks && searchKey(n.ru) === kr) || null;
}

// ---------- Карточки ----------
export async function listCards() { return db.getAll('cards'); }
export async function saveCard(card) { await db.put('cards', card); }

/**
 * Карточки, доступные для учёбы: не приостановлены, направление включено в колоде.
 * deckId = 'all' — все колоды.
 */
export async function studyCards(deckId = 'all') {
  const [cards, decks] = await Promise.all([db.getAll('cards'), db.getAll('decks')]);
  const dirs = Object.fromEntries(decks.map((d) => [d.id, d.directions || { ru2sk: true, sk2ru: true }]));
  return cards.filter((c) => (c.kind || 'vocab') === 'vocab'
    && !c.suspended
    && (deckId === 'all' || c.deckId === deckId)
    && dirs[c.deckId]?.[c.dir] !== false
    && dirs[c.deckId] !== undefined);
}

// ---------- Картинки ----------
/** URL картинки слова из IndexedDB (картинки из .apkg). Не забудь URL.revokeObjectURL. */
export async function mediaUrl(id) {
  if (!id) return null;
  const rec = await db.get('media', id);
  return rec?.blob ? URL.createObjectURL(rec.blob) : null;
}

// ---------- Журнал ----------
export async function logReview(entry) {
  const rec = { id: uid('r-'), ts: Date.now(), kind: 'vocab', ...entry };
  await db.put('reviews', rec);
  return rec;
}

export async function reviewsSince(ts) {
  return db.getRange('reviews', 'ts', ts, Number.MAX_SAFE_INTEGER);
}

export async function todayReviews() { return reviewsSince(dayStart()); }

export async function logSession(s) {
  await db.put('sessions', { id: uid('s-'), ...s });
}

// ---------- Стартовые данные ----------
/**
 * Создаёт колоды «Moje chyby» и «Slovník» и 3 стартовых слова.
 * У записей фиксированные id и updatedAt = 1: на втором устройстве они не задвоятся
 * и не перезапишут правки, пришедшие из облака.
 */
export async function seedIfEmpty() {
  if (await db.getMeta('seeded')) return false;
  const existingDecks = await db.count('decks');
  if (existingDecks > 0) { await db.setMeta('seeded', true); return false; }

  const T = 1;
  const decks = [
    { id: SEED_DECKS.chyby, name: 'Moje chyby', order: 0, directions: { ru2sk: true, sk2ru: true }, createdAt: T, updatedAt: T },
    { id: SEED_DECKS.slovnik, name: 'Slovník', order: 1, directions: { ru2sk: true, sk2ru: true }, createdAt: T, updatedAt: T },
  ];
  const notes = [
    { id: 'seed-patnast', sk: 'pätnásť', ru: 'пятнадцать', example: '' },
    { id: 'seed-hovoris', sk: 'hovoríš', ru: '(ты) говоришь', example: 'Hovoríš po slovensky?' },
    { id: 'seed-byvat', sk: 'bývať', ru: 'жить, проживать', example: 'Bývam v Bratislave.' },
  ].map((n, i) => ({ ...n, deckId: SEED_DECKS.chyby, active: true, img: null, source: 'seed', createdAt: T + i, order: i, updatedAt: T }));

  await db.put('decks', decks, { keepTime: true });
  await db.put('notes', notes, { keepTime: true });
  const cards = notes.flatMap((n) => DIRS.map((dir) => ({
    ...newCardState(), id: `${n.id}:${dir}`, noteId: n.id, deckId: n.deckId, dir, kind: 'vocab',
    suspended: false, order: n.order, createdAt: T, updatedAt: T,
  })));
  await db.put('cards', cards, { keepTime: true });
  await db.setMeta('seeded', true);
  return true;
}
