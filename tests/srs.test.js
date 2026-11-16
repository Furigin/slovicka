import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, preview, formatInterval, newCardState, maturity, dueInDays, AGAIN, HARD, GOOD, EASY } from '../js/srs.js';
import { MIN, dayStart, daysBetween } from '../js/days.js';

const NOW = new Date(2026, 10, 16, 18, 0).getTime(); // 16.11.2026 18:00
const noFuzz = () => 0.5;
const run = (card, grade, now = NOW, cfg = {}) => schedule(card, grade, now, cfg, noFuzz);

test('новая карточка: Znova → 1 мин, Dobré → 10 мин, Ľahké → 4 дня', () => {
  const c = newCardState();
  const again = run(c, AGAIN);
  assert.equal(again.type, 'learning');
  assert.equal(again.due - NOW, 1 * MIN);
  assert.equal(again.ease, 2.5);

  const good = run(c, GOOD);
  assert.equal(good.type, 'learning');
  assert.equal(good.step, 1);
  assert.equal(good.due - NOW, 10 * MIN);

  const easy = run(c, EASY);
  assert.equal(easy.type, 'review');
  assert.equal(easy.interval, 4);
  assert.equal(easy.due, dueInDays(NOW, 4));
});

test('Ťažké на первом шаге — среднее первых двух шагов (5,5 мин)', () => {
  const hard = run(newCardState(), HARD);
  assert.equal(hard.due - NOW, 5.5 * MIN);
  assert.equal(hard.step, 0);
});

test('шаги обучения: 1 мин → 10 мин → повторение через 1 день', () => {
  let c = run(newCardState(), GOOD);          // шаг 1 (10 мин)
  c = run(c, GOOD, NOW + 10 * MIN);           // выпуск
  assert.equal(c.type, 'review');
  assert.equal(c.interval, 1);
  assert.equal(daysBetween(NOW, c.due), 1);
  assert.equal(new Date(c.due).getHours(), 4); // начало учебного дня
});

test('Znova в обучении возвращает на первый шаг', () => {
  let c = run(newCardState(), GOOD);
  c = run(c, AGAIN, NOW + 10 * MIN);
  assert.equal(c.step, 0);
  assert.equal(c.due, NOW + 10 * MIN + 1 * MIN);
});

test('повторение: интервалы растут, Ľahké > Dobré > Ťažké', () => {
  const card = { ...newCardState(), type: 'review', interval: 10, ease: 2.5, due: dueInDays(NOW, 0) };
  const h = run(card, HARD), g = run(card, GOOD), e = run(card, EASY);
  assert.equal(h.interval, 12);           // 10 * 1.2
  assert.equal(g.interval, 25);           // 10 * 2.5
  assert.equal(e.interval, 33);           // 10 * 2.5 * 1.3 = 32.5 → 33
  assert.ok(h.interval < g.interval && g.interval < e.interval);
  assert.equal(h.ease, 2.35);
  assert.equal(g.ease, 2.5);
  assert.equal(e.ease, 2.65);
});

test('повторение: Znova → переобучение, ease −0.2, lapses+1, после шага интервал 1 день', () => {
  const card = { ...newCardState(), type: 'review', interval: 30, ease: 2.5, due: NOW };
  const a = run(card, AGAIN);
  assert.equal(a.type, 'relearning');
  assert.equal(a.lapses, 1);
  assert.equal(a.ease, 2.3);
  assert.equal(a.due - NOW, 10 * MIN);
  const back = run(a, GOOD, NOW + 10 * MIN);
  assert.equal(back.type, 'review');
  assert.equal(back.interval, 1);
});

test('ease не опускается ниже 1.3', () => {
  let card = { ...newCardState(), type: 'review', interval: 5, ease: 1.35, due: NOW };
  card = run(card, AGAIN);
  assert.equal(card.ease, 1.3);
});

test('опоздание учитывается: опоздал на 4 дня → интервал больше', () => {
  const card = { ...newCardState(), type: 'review', interval: 10, ease: 2.5, due: dueInDays(NOW, -4) };
  const g = run(card, GOOD);
  assert.equal(g.interval, Math.round((10 + 2) * 2.5)); // 30
});

test('максимальный интервал ограничен', () => {
  const card = { ...newCardState(), type: 'review', interval: 3000, ease: 3, due: NOW };
  assert.equal(run(card, EASY, NOW, { maxInterval: 3650 }).interval, 3650);
});

test('исходная карточка не меняется (чистая функция)', () => {
  const card = newCardState();
  const copy = { ...card };
  run(card, GOOD);
  assert.deepEqual(card, copy);
});

test('предпросмотр и формат интервалов под кнопками', () => {
  const p = preview(newCardState(), NOW);
  assert.equal(formatInterval(p[1]), '1 min');
  assert.equal(formatInterval(p[3]), '10 min');
  assert.equal(formatInterval(p[4]), '4 d');
  assert.equal(formatInterval(p[4], 'ru'), '4 д');
  assert.equal(formatInterval({ learning: false, days: 45 }), '1,5 mes.');
  assert.equal(formatInterval({ learning: false, days: 400 }), '1,1 r.');
  assert.equal(formatInterval({ learning: true, ms: 90 * MIN }), '1,5 h');
});

test('разброс (fuzz) только для интервалов ≥ 3 дней и в пределах 5%', () => {
  const card = { ...newCardState(), type: 'review', interval: 100, ease: 2.5, due: NOW };
  const lo = schedule(card, GOOD, NOW, {}, () => 0).interval;
  const hi = schedule(card, GOOD, NOW, {}, () => 0.999).interval;
  assert.ok(lo >= 237 && lo <= 250, `lo=${lo}`);
  assert.ok(hi >= 250 && hi <= 263, `hi=${hi}`);
});

test('зрелость: молодые < 21 д ≤ зрелые', () => {
  assert.equal(maturity(newCardState()), 'new');
  assert.equal(maturity({ type: 'learning' }), 'learning');
  assert.equal(maturity({ type: 'review', interval: 20 }), 'young');
  assert.equal(maturity({ type: 'review', interval: 21 }), 'mature');
});

test('день начинается в 4:00: 1 ночи — это ещё вчера', () => {
  const night = new Date(2026, 10, 17, 1, 0).getTime();
  assert.equal(dayStart(night), new Date(2026, 10, 16, 4, 0).getTime());
});
