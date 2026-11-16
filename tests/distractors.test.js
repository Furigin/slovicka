import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickDistractors } from '../js/distractors.js';

const pool = [
  { text: 'pätnásť', deckId: 'a', noteId: '1' },
  { text: 'Pätnásť', deckId: 'b', noteId: '9' },   // дубль правильного (другой регистр)
  { text: 'štrnásť', deckId: 'a', noteId: '2' },
  { text: 'šestnásť', deckId: 'a', noteId: '3' },
  { text: 'dom', deckId: 'a', noteId: '4' },
  { text: 'sedemnásť', deckId: 'b', noteId: '5' },
  { text: 'nemocnica na okraji mesta', deckId: 'a', noteId: '6' },
  { text: 'štrnásť', deckId: 'b', noteId: '7' },   // дубль дистрактора
];

test('3 дистрактора, без правильного ответа и без дублей', () => {
  const d = pickDistractors('pätnásť', pool, { deckId: 'a', noteId: '1', rng: () => 0.5 });
  assert.equal(d.length, 3);
  assert.ok(!d.some((x) => x.toLowerCase() === 'pätnásť'));
  assert.equal(new Set(d).size, 3);
});

test('сначала та же колода и похожая длина', () => {
  const d = pickDistractors('pätnásť', pool, { deckId: 'a', noteId: '1', rng: () => 0.5 });
  assert.deepEqual(d.slice(0, 2).sort(), ['šestnásť', 'štrnásť']);
  assert.ok(!d.includes('nemocnica na okraji mesta'));
});

test('если вариантов мало — возвращает сколько есть', () => {
  const d = pickDistractors('x', [{ text: 'y', noteId: '1' }], {});
  assert.deepEqual(d, ['y']);
});
