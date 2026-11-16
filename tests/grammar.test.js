import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vocalize, verbExercise, nounExercise, validateItem, CASES } from '../js/grammar-core.js';
import { compare } from '../js/compare.js';

const data = JSON.parse(readFileSync('data/grammar.json', 'utf8'));
const noun = (id) => data.nouns.find((n) => n.id === id);

test('данные: ≥ 40 глаголов, 12 словацких образцов, всё verified:false, без чешских букв', () => {
  assert.ok(data.verbs.length >= 40);
  const patterns = new Set(data.nouns.filter((n) => n.model).map((n) => n.pattern));
  assert.deepEqual([...patterns].sort(), ['chlap', 'dievča', 'dlaň', 'dub', 'hrdina', 'kosť', 'mesto', 'srdce', 'stroj', 'ulica', 'vysvedčenie', 'žena'].sort());
  for (const it of [...data.verbs, ...data.nouns]) {
    assert.equal(it.verified, false, it.id);
    assert.ok(validateItem(it), `формат: ${it.id}`);
    assert.ok(!/[řůěŘŮĚ]/.test(JSON.stringify(it)), `чешская буква: ${it.id}`);
  }
  const ids = [...data.verbs, ...data.nouns].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'id не уникальны');
});

test('данные: ключевые формы (выборочно)', () => {
  const v = (id) => data.verbs.find((x) => x.id === id).present;
  assert.deepEqual(v('v-byt'), ['som', 'si', 'je', 'sme', 'ste', 'sú']);
  assert.equal(v('v-robit')[5], 'robia');
  assert.equal(v('v-vediet')[5], 'vedia');
  assert.equal(v('v-moct')[0], 'môžem');
  assert.equal(noun('n-bratislava').sg[4], 'Bratislave');
  assert.equal(noun('n-srdce').pl[1], 'sŕdc');
  assert.equal(noun('n-dievca').sg[1], 'dievčaťa');
});

test('слоговые предлоги', () => {
  assert.equal(vocalize('v', 'vlaku'), 'vo');
  assert.equal(vocalize('v', 'Viedni'), 'vo');
  assert.equal(vocalize('v', 'Bratislave'), 'v');
  assert.equal(vocalize('s', 'ženou'), 'so');
  assert.equal(vocalize('s', 'bratom'), 's');
  assert.equal(vocalize('z', 'školy'), 'zo');
  assert.equal(vocalize('k', 'kolegovi'), 'ku');
});

test('глагол: «robiť → oni ___» → robia, принимается и «oni robia»', () => {
  const v = data.verbs.find((x) => x.id === 'v-robit');
  const ex = verbExercise(v, () => 0.99);
  assert.equal(ex.before, 'robiť → oni');
  assert.equal(ex.answer, 'robia');
  assert.equal(compare('robia', ex.accept).verdict, 'correct');
  assert.equal(compare('oni robia', ex.accept).verdict, 'correct');
  assert.equal(compare('robja', ex.accept).verdict, 'wrong');
});

test('существительное: «v ___ (Bratislava)» → Bratislave / v Bratislave', () => {
  const ex = nounExercise(noun('n-bratislava'), () => 0.99, { number: 'sg', case: 'loc' });
  assert.equal(ex.before, 'v');
  assert.equal(ex.answer, 'Bratislave');
  assert.equal(compare('Bratislave', ex.accept).verdict, 'correct');
  assert.equal(compare('v Bratislave', ex.accept).verdict, 'correct');
  assert.equal(compare('v Bratislava', ex.accept).verdict, 'wrong');
});

test('na Slovensku, vo vlaku, pri mori', () => {
  assert.equal(nounExercise(noun('n-slovensko'), () => 0.99, { number: 'sg', case: 'loc' }).before, 'na');
  assert.equal(nounExercise(noun('n-vlak'), () => 0.99, { number: 'sg', case: 'loc' }).before, 'vo');
  assert.equal(nounExercise(noun('n-more'), () => 0.99, { number: 'sg', case: 'loc' }).before, 'pri');
});

test('слова без мн. ч. не дают упражнений во мн. ч.; у каждого слова есть упражнения', () => {
  assert.equal(nounExercise(noun('n-praha'), Math.random, { number: 'pl' }), null);
  for (const n of data.nouns) {
    for (let i = 0; i < 20; i++) {
      const ex = nounExercise(n, Math.random);
      assert.ok(ex && ex.answer && CASES.includes(ex.case), n.id);
    }
  }
});
