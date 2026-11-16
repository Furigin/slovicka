import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityByDay, streak, distribution, forecast, todaySummary } from '../js/stats-calc.js';
import { dueInDays } from '../js/srs.js';

const NOW = new Date(2026, 10, 16, 18, 0).getTime();
const D = 864e5;
const rev = (daysAgo, n = 1, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ ts: NOW - daysAgo * D - i * 1000, grade: 3, typeBefore: 'review', ms: 5000, ...extra }));

test('серия: 3 дня подряд, включая сегодня', () => {
  const act = activityByDay([...rev(0, 10), ...rev(1, 10), ...rev(2, 10), ...rev(4, 10)]);
  assert.deepEqual(streak(act, 10, NOW), { current: 3, best: 3, todayDone: true });
});

test('серия не сгорает, пока сегодня не закончился', () => {
  const act = activityByDay([...rev(1, 10), ...rev(2, 10)]);
  assert.equal(streak(act, 10, NOW).current, 2);
  assert.equal(streak(act, 10, NOW).todayDone, false);
});

test('день засчитан при ≥ N карточек или ≥ 1 завершённой сессии', () => {
  const few = activityByDay(rev(0, 3));
  assert.equal(streak(few, 10, NOW).current, 0);
  const withSession = activityByDay(rev(0, 3), [{ end: NOW - 1000, count: 3 }]);
  assert.equal(streak(withSession, 10, NOW).current, 1);
});

test('рекорд серии считается по всей истории', () => {
  const act = activityByDay([...rev(10, 5), ...rev(11, 5), ...rev(12, 5), ...rev(13, 5), ...rev(0, 5)]);
  assert.deepEqual(streak(act, 5, NOW), { current: 1, best: 4, todayDone: true });
});

test('сегодня: точность, новые, время (зависания > 60 с не считаются)', () => {
  const act = activityByDay([...rev(0, 3), { ts: NOW, grade: 1, typeBefore: 'new', ms: 600000 }]);
  const s = todaySummary(act, NOW);
  assert.equal(s.reviewed, 4);
  assert.equal(s.newCards, 1);
  assert.equal(s.accuracy, 0.75);
  assert.equal(s.ms, 3 * 5000 + 60000);
});

test('ошибки диакритики считаются только в режимах с вводом', () => {
  const act = activityByDay([
    ...rev(0, 2, { mode: 'typing', diacritic: true }), ...rev(0, 3, { mode: 'typing' }), ...rev(0, 4, { mode: 'cards' }),
  ]);
  const d = [...act.values()][0];
  assert.equal(d.diacritic, 2);
  assert.equal(d.typed, 5);
});

test('распределение и прогноз', () => {
  const cards = [
    { type: 'new' }, { type: 'learning', due: NOW }, { type: 'review', interval: 5, due: NOW - D },
    { type: 'review', interval: 30, due: dueInDays(NOW, 2) }, { type: 'review', interval: 30, due: dueInDays(NOW, 2), suspended: true },
  ];
  assert.deepEqual(distribution(cards), { new: 1, learning: 1, young: 1, mature: 1 });
  assert.deepEqual(forecast(cards, 4, NOW), [2, 0, 1, 0]);
});
