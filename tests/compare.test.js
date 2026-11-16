import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, alternatives } from '../js/compare.js';
import { foldLatin, normalizeAnswer, searchKey } from '../js/textutil.js';

const joined = (segs, t) => segs.filter((s) => s.t === t).map((s) => s.s).join('');

test('полное совпадение → Dobré', () => {
  const r = compare('pätnásť', 'pätnásť');
  assert.equal(r.verdict, 'correct');
  assert.equal(r.grade, 3);
});

test('регистр, пробелы и концевая точка игнорируются', () => {
  assert.equal(compare('  Bývam   v Bratislave ', 'Bývam v Bratislave.').verdict, 'correct');
  assert.equal(compare('PÄTNÁSŤ', 'pätnásť').verdict, 'correct');
});

test('pätnast vs pätnásť — ошибка в диакритике, подсвечены á и ť', () => {
  const r = compare('pätnast', 'pätnásť');
  assert.equal(r.verdict, 'diacritics');
  assert.equal(r.grade, 2);
  assert.equal(r.diacriticErrors, 2);
  assert.equal(joined(r.expected, 'fix'), 'áť');
  assert.equal(joined(r.user, 'bad'), 'at');
  // сегменты собираются обратно в исходные строки
  assert.equal(r.user.map((s) => s.s).join(''), 'pätnast');
  assert.equal(r.expected.map((s) => s.s).join(''), 'pätnásť');
});

test('hovoriš vs hovoríš — диакритика', () => {
  const r = compare('hovoriš', 'hovoríš');
  assert.equal(r.verdict, 'diacritics');
  assert.equal(joined(r.expected, 'fix'), 'í');
});

test('лишняя диакритика — тоже ошибка диакритики', () => {
  assert.equal(compare('pätnáśť', 'pätnásť').verdict, 'diacritics');
  assert.equal(compare('bývať', 'byvať').verdict, 'diacritics');
});

test('явная ошибка → Znova и подсветка', () => {
  const r = compare('patnadsat', 'pätnásť');
  assert.equal(r.verdict, 'wrong');
  assert.equal(r.grade, 1);
  assert.ok(r.distance >= 3);
  assert.equal(r.expected.map((s) => s.s).join(''), 'pätnásť');
});

test('пустой ответ — ошибка', () => {
  assert.equal(compare('   ', 'dom').verdict, 'wrong');
});

test('русские ответы: ё = е', () => {
  assert.equal(compare('еще', 'ещё').verdict, 'correct');
  assert.equal(compare('ещё', 'еще').verdict, 'correct');
});

test('русская «й» не превращается в «и» (кириллицу не складываем)', () => {
  assert.equal(compare('мои', 'мой').verdict, 'wrong');
});

test('несколько вариантов через ; и /', () => {
  assert.equal(compare('dom', 'dom; domov').verdict, 'correct');
  assert.equal(compare('domov', 'dom / domov').verdict, 'correct');
  assert.equal(compare('domov', 'dom/domov').verdict, 'correct');
});

test('скобки необязательны: «(ты) говоришь»', () => {
  assert.equal(compare('говоришь', '(ты) говоришь').verdict, 'correct');
  assert.equal(compare('ты говоришь', '(ты) говоришь').verdict, 'correct');
});

test('синонимы через запятую: «жить, проживать»', () => {
  assert.equal(compare('проживать', 'жить, проживать').verdict, 'correct');
  assert.equal(compare('жить, проживать', 'жить, проживать').verdict, 'correct');
  // длинные предложения с запятой не дробятся
  assert.deepEqual(alternatives('Keď prší, sedím doma a čítam knihu'), ['Keď prší, sedím doma a čítam knihu']);
});

test('диакритика в одном из вариантов', () => {
  const r = compare('domá', 'dom; doma');
  assert.equal(r.verdict, 'diacritics');
  assert.equal(r.matched, 'doma');
});

test('foldLatin снимает только латинскую диакритику', () => {
  assert.equal(foldLatin('ľúbiť ťava ôsmy dážď'), 'lubit tava osmy dazd');
  assert.equal(foldLatin('йод ёж'), 'йод ёж');
  assert.equal(normalizeAnswer('  Ёлка!! '), 'елка');
  assert.equal(searchKey('Pätnásť'), 'patnast');
});
