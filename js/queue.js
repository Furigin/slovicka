// Очередь карточек на сессию и подсчёт «сколько на сегодня».
// Чистые функции — тестируются в tests/queue.test.js.
//
// Правила (как в Anki):
//  - карточки в обучении (шаги 1 мин / 10 мин) показываются, когда подошло время;
//  - повторения — не больше дневного лимита, новые — не больше лимита новых;
//  - «братья» (RU→SK и SK→RU одного слова) не показываются в один день,
//    кроме карточек в обучении.

import { dayEnd } from './days.js';

export const LEARN_AHEAD_MS = 20 * 60_000;

const isLearning = (c) => c.type === 'learning' || c.type === 'relearning';

/**
 * Сколько карточек на сегодня.
 * @param cards     все доступные карточки (уже отфильтрованы по колоде/направлению/приостановке)
 * @param today     { newDone, reviewsDone, seenNotes:Set } — что уже сделано сегодня (из журнала)
 * @param limits    { newPerDay, reviewsPerDay }
 */
export function countToday(cards, now, today, limits) {
  const end = dayEnd(now);
  let learning = 0, review = 0;
  const newNotes = new Set();
  for (const c of cards) {
    if (isLearning(c)) { if (c.due < end) learning++; }
    else if (c.type === 'review') { if (c.due < end && !today.seenNotes.has(c.noteId ?? c.id)) review++; }
    else if (c.type === 'new') {
      const key = c.noteId ?? c.id;
      if (!today.seenNotes.has(key)) newNotes.add(key);
    }
  }
  return {
    learning,
    review: Math.max(0, Math.min(review, limits.reviewsPerDay - today.reviewsDone)),
    new: Math.max(0, Math.min(newNotes.size, limits.newPerDay - today.newDone)),
  };
}

/** Детерминированное перемешивание (чтобы новые слова шли не строго по алфавиту/импорту). */
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Очередь одной сессии.
 *   const q = new SessionQueue(cards, { now, today, limits });
 *   q.next(now) → { card } | { wait: ms } | null
 *   q.answered(oldCard, newCard, now)
 */
export class SessionQueue {
  constructor(cards, { now = Date.now(), today, limits, rng = Math.random, newOrder = 'added' } = {}) {
    const end = dayEnd(now);
    this.seenNotes = new Set(today.seenNotes);
    this.learning = cards.filter((c) => isLearning(c) && c.due < end).sort((a, b) => a.due - b.due);

    const reviewsLeft = Math.max(0, limits.reviewsPerDay - today.reviewsDone);
    const due = cards
      .filter((c) => c.type === 'review' && c.due < end && !this.seenNotes.has(c.noteId ?? c.id))
      .sort((a, b) => a.due - b.due);
    // один «брат» на слово в день
    const reviewNotes = new Set();
    this.reviews = [];
    for (const c of due) {
      const k = c.noteId ?? c.id;
      if (reviewNotes.has(k)) continue;
      reviewNotes.add(k);
      this.reviews.push(c);
      if (this.reviews.length >= reviewsLeft) break;
    }
    this.reviews = shuffle(this.reviews, rng);

    const newLeft = Math.max(0, limits.newPerDay - today.newDone);
    let fresh = cards.filter((c) => c.type === 'new' && !this.seenNotes.has(c.noteId ?? c.id));
    fresh.sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));
    if (newOrder === 'random') fresh = shuffle(fresh, rng);
    const newNotes = new Set();
    this.fresh = [];
    for (const c of fresh) {
      const k = c.noteId ?? c.id;
      if (newNotes.has(k) || reviewNotes.has(k)) continue;
      newNotes.add(k);
      this.fresh.push(c);
      if (this.fresh.length >= newLeft) break;
    }

    this.shownNew = 0;
    this.shownReview = 0;
    this.total = this.learning.length + this.reviews.length + this.fresh.length;
  }

  /** Сколько осталось (для прогресс-бара). */
  remaining() { return this.learning.length + this.reviews.length + this.fresh.length; }

  counts() {
    return { learning: this.learning.length, review: this.reviews.length, new: this.fresh.length };
  }

  next(now = Date.now(), { allowLearnAhead = true } = {}) {
    this.learning.sort((a, b) => a.due - b.due);
    // 1. карточки в обучении, у которых подошло время
    if (this.learning.length && this.learning[0].due <= now) return { card: this.learning[0] };
    // 2. повторения и новые вперемешку (новые — равномерно между повторениями)
    const r = this.reviews.length, n = this.fresh.length;
    if (r || n) {
      const pickNew = n && (!r || (this.shownNew + 1) / (this.shownNew + this.shownReview + 2) <= n / (n + r));
      return { card: pickNew ? this.fresh[0] : this.reviews[0] };
    }
    // 3. обучение «вперёд» (если до карточки ≤ 20 мин и больше ничего нет)
    if (this.learning.length) {
      const wait = this.learning[0].due - now;
      if (allowLearnAhead && wait <= LEARN_AHEAD_MS) return { card: this.learning[0] };
      return { wait };
    }
    return null;
  }

  /** Отметить ответ: убрать карточку из очередей и, если она ещё учится сегодня, вернуть её в обучение. */
  answered(oldCard, newCard, now = Date.now()) {
    const drop = (list) => {
      const i = list.findIndex((c) => c.id === oldCard.id);
      if (i >= 0) list.splice(i, 1);
      return i >= 0;
    };
    if (drop(this.fresh)) this.shownNew++;
    else if (drop(this.reviews)) this.shownReview++;
    else drop(this.learning);

    this.seenNotes.add(oldCard.noteId ?? oldCard.id);
    if (isLearning(newCard) && newCard.due < dayEnd(now)) this.learning.push(newCard);
  }

  /** Убрать карточку из сессии без ответа (например, приостановили). */
  remove(cardId) {
    for (const list of [this.fresh, this.reviews, this.learning]) {
      const i = list.findIndex((c) => c.id === cardId);
      if (i >= 0) list.splice(i, 1);
    }
  }
}

/**
 * Сводка «что уже сделано сегодня» по журналу ответов.
 * reviews — записи журнала за сегодня.
 */
export function todayFromLog(reviews, kind = 'vocab') {
  let newDone = 0, reviewsDone = 0;
  const seenNotes = new Set();
  for (const r of reviews) {
    if ((r.kind || 'vocab') !== kind) continue;
    if (r.typeBefore === 'new') newDone++;
    else if (r.typeBefore === 'review') reviewsDone++;
    if (r.noteId) seenNotes.add(r.noteId);
    else if (r.cardId) seenNotes.add(r.cardId);
  }
  return { newDone, reviewsDone, seenNotes };
}
