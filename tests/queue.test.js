import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionQueue, countToday, todayFromLog } from '../js/queue.js';
import { schedule, newCardState, dueInDays, GOOD, AGAIN } from '../js/srs.js';
import { MIN } from '../js/days.js';

const NOW = new Date(2026, 10, 16, 18, 0).getTime();
const empty = { newDone: 0, reviewsDone: 0, seenNotes: new Set() };
const limits = { newPerDay: 10, reviewsPerDay: 200 };

const newCard = (note, dir = 'ru2sk', order = 0) => ({ ...newCardState(), id: `${note}:${dir}`, noteId: note, order });
const reviewCard = (note, dueDays = 0, dir = 'ru2sk') =>
  ({ ...newCardState(), id: `${note}:${dir}`, noteId: note, type: 'review', interval: 5, ease: 2.5, due: dueInDays(NOW, dueDays) });

test('лимит новых: показывается не больше newPerDay, по одному направлению на слово', () => {
  const cards = [];
  for (let i = 0; i < 20; i++) cards.push(newCard(`n${i}`, 'ru2sk', i), newCard(`n${i}`, 'sk2ru', i));
  const q = new SessionQueue(cards, { now: NOW, today: empty, limits, rng: () => 0.3 });
  assert.equal(q.fresh.length, 10);
  assert.equal(new Set(q.fresh.map((c) => c.noteId)).size, 10);
  const counts = countToday(cards, NOW, empty, limits);
  assert.equal(counts.new, 10);
});

test('лимит учитывает уже сделанное сегодня', () => {
  const cards = Array.from({ length: 20 }, (_, i) => newCard(`n${i}`));
  const today = { newDone: 7, reviewsDone: 0, seenNotes: new Set() };
  assert.equal(countToday(cards, NOW, today, limits).new, 3);
  assert.equal(new SessionQueue(cards, { now: NOW, today, limits }).fresh.length, 3);
});

test('повторения: только просроченные/сегодняшние, не больше лимита', () => {
  const cards = [reviewCard('a', 0), reviewCard('b', -3), reviewCard('c', 2)];
  const q = new SessionQueue(cards, { now: NOW, today: empty, limits: { newPerDay: 10, reviewsPerDay: 1 } });
  assert.equal(q.reviews.length, 1);
  assert.equal(countToday(cards, NOW, empty, limits).review, 2);
});

test('сценарий сессии: новая → 1 мин → ждём → 10 мин → выпуск', () => {
  const card = newCard('x');
  const q = new SessionQueue([card], { now: NOW, today: empty, limits });
  let n = q.next(NOW);
  assert.equal(n.card.id, 'x:ru2sk');

  let upd = { ...n.card, ...schedule(n.card, AGAIN, NOW, {}, () => 0.5) };
  q.answered(n.card, upd, NOW);
  // Больше ничего нет — карточка в обучении через 1 мин, показываем заранее (learn ahead ≤ 20 мин)
  n = q.next(NOW);
  assert.equal(n.card.id, 'x:ru2sk');
  // Без «вперёд» — ждём ~1 минуту
  const w = q.next(NOW, { allowLearnAhead: false });
  assert.equal(w.wait, 1 * MIN);

  const t1 = NOW + MIN;
  upd = { ...upd, ...schedule(upd, GOOD, t1, {}, () => 0.5) };
  q.answered(n.card, upd, t1);
  const t2 = t1 + 10 * MIN;
  n = q.next(t2);
  upd = { ...upd, ...schedule(n.card, GOOD, t2, {}, () => 0.5) };
  assert.equal(upd.type, 'review');
  q.answered(n.card, upd, t2);
  assert.equal(q.next(t2), null);
});

test('новые перемешаны с повторениями равномерно', () => {
  const cards = [
    ...Array.from({ length: 4 }, (_, i) => newCard(`n${i}`, 'ru2sk', i)),
    ...Array.from({ length: 8 }, (_, i) => reviewCard(`r${i}`)),
  ];
  const q = new SessionQueue(cards, { now: NOW, today: empty, limits, rng: () => 0.1 });
  const seq = [];
  let n;
  while ((n = q.next(NOW))) {
    seq.push(n.card.type === 'new' ? 'N' : 'R');
    const upd = { ...n.card, type: 'review', interval: 3, due: dueInDays(NOW, 3) };
    q.answered(n.card, upd, NOW);
  }
  assert.equal(seq.length, 12);
  assert.equal(seq.filter((s) => s === 'N').length, 4);
  // первая новая не позже 4-й позиции, а не все в конце
  assert.ok(seq.indexOf('N') <= 3, seq.join(''));
  assert.ok(seq.lastIndexOf('R') > seq.indexOf('N'), seq.join(''));
});

test('брат слова, уже повторённого сегодня, не показывается', () => {
  const cards = [reviewCard('w', 0, 'ru2sk'), reviewCard('w', 0, 'sk2ru')];
  const q = new SessionQueue(cards, { now: NOW, today: empty, limits });
  assert.equal(q.reviews.length, 1);
  const today = todayFromLog([{ noteId: 'w', cardId: 'w:ru2sk', typeBefore: 'review', kind: 'vocab' }]);
  assert.equal(today.reviewsDone, 1);
  assert.equal(countToday(cards, NOW, today, limits).review, 0);
});
