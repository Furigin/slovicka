import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpFor, totalXp, levelInfo, xpForLevel, levelTitle, achievementStats, unlockedIds, wordOfDay, ACHIEVEMENTS } from '../js/gamify.js';

test('XP: оценка, режим, новое слово, комбо', () => {
  assert.equal(xpFor({ grade: 3, mode: 'cards' }), 10);
  assert.equal(xpFor({ grade: 1, mode: 'cards' }), 2);
  assert.equal(xpFor({ grade: 3, mode: 'typing' }), 15);
  assert.equal(xpFor({ grade: 3, mode: 'cards', typeBefore: 'new' }), 15);
  assert.equal(xpFor({ grade: 3, mode: 'cards' }, 4), 12);   // комбо с 5-го верного
  assert.equal(xpFor({ grade: 3, mode: 'cards' }, 30), 20);  // бонус не больше +10
  assert.equal(xpFor({ grade: 2, mode: 'typing', diacritic: true }, 10), 9); // ошибка в диакритике — без комбо
});

test('сумма XP берёт сохранённый xp, а для старых записей считает', () => {
  assert.equal(totalXp([{ xp: 7 }, { grade: 3, mode: 'cards' }]), 17);
});

test('уровни: 0 → L1, 100 → L2, 300 → L3, прогресс внутри уровня', () => {
  assert.equal(xpForLevel(2), 100);
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(99).level, 1);
  assert.equal(levelInfo(100).level, 2);
  const l = levelInfo(450);
  assert.equal(l.level, 3);
  assert.equal(l.into, 150);
  assert.equal(l.need, 300);
  assert.equal(levelTitle(1), 'Nováčik');
  assert.equal(levelTitle(9, 'ru'), 'Студент');
});

test('достижения: серия, комбо, чистая диакритика, ночная сова', () => {
  const late = new Date(2026, 10, 16, 23, 30).getTime();
  const s = achievementStats({
    reviews: [{ ts: late, grade: 3, mode: 'typing' }],
    sessions: [{ count: 12, maxCombo: 11, typed: 12, diaErr: 0 }],
    notes: [{ active: true, source: 'anki' }],
    streakBest: 7,
  });
  const ids = unlockedIds(s);
  for (const id of ['first', 'streak3', 'streak7', 'combo10', 'clean', 'night', 'import']) assert.ok(ids.includes(id), id);
  for (const id of ['streak30', 'combo25', 'early', 'rev100']) assert.ok(!ids.includes(id), id);
});

test('у всех достижений есть тексты на двух языках и уникальные id', () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const a of ACHIEVEMENTS) assert.ok(a.sk && a.ru && a.dsk && a.dru && a.face, a.id);
  assert.ok(!/[řůě]/i.test(JSON.stringify(ACHIEVEMENTS.map((a) => [a.sk, a.dsk]))));
});

test('слово дня одинаковое весь день и меняется по дням', () => {
  const notes = Array.from({ length: 50 }, (_, i) => ({ id: `n${i}`, sk: `s${i}`, ru: `r${i}` }));
  assert.equal(wordOfDay(notes, '2026-11-16').id, wordOfDay(notes.slice().reverse(), '2026-11-16').id);
  const days = new Set(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'].map((k) => wordOfDay(notes, k).id));
  assert.ok(days.size >= 2);
  assert.equal(wordOfDay([]), null);
});
