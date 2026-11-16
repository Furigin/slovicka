import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, localTime } from '../js/reminder-rules.js';
import { buildIcs } from '../js/ics.js';

// 16.11.2026 — зима, Братислава = UTC+1
const at = (h, m = 7) => Date.UTC(2026, 10, 16, h - 1, m);
const doc = (extra = {}) => ({
  enabled: true, subscription: { endpoint: 'x' }, timeZone: 'Europe/Bratislava', lang: 'sk',
  reminderHour: 19, saverHour: 21, lastStudyDay: '2026-11-15', streak: 5,
  dueByDay: { '2026-11-16': 12 }, lastSent: {}, ...extra,
});

test('местное время и учебный день (смена в 4:00)', () => {
  assert.deepEqual(localTime(at(19), 'Europe/Bratislava'), { hour: 19, studyDay: '2026-11-16' });
  assert.deepEqual(localTime(at(2), 'Europe/Bratislava'), { hour: 2, studyDay: '2026-11-15' });
});

test('в 19:07 — ежедневное напоминание с количеством карточек и серией', () => {
  const r = decide(doc(), at(19));
  assert.equal(r.kind, 'daily');
  assert.equal(r.body, 'Na dnes: 12 kariet · séria 5 d');
  assert.equal(r.day, '2026-11-16');
});

test('опоздание GitHub Actions до 2 часов — всё ещё отправляем, позже — нет', () => {
  assert.equal(decide(doc({ saverHour: null }), at(20, 50))?.kind, 'daily');
  assert.equal(decide(doc({ saverHour: null }), at(21, 5)), null);
});

test('не отправляем: уже учился сегодня, уже отправляли, рано, выключено', () => {
  assert.equal(decide(doc({ lastStudyDay: '2026-11-16' }), at(19)), null);
  assert.equal(decide(doc({ lastSent: { daily: '2026-11-16' } }), at(19)), null);
  assert.equal(decide(doc(), at(17)), null);
  assert.equal(decide(doc({ enabled: false }), at(19)), null);
});

test('21:00 — «спаси серию», только если серия есть', () => {
  const r = decide(doc({ lastSent: { daily: '2026-11-16' } }), at(21));
  assert.equal(r.kind, 'saver');
  assert.equal(r.title, 'Séria 5 d je v ohrození!');
  assert.equal(decide(doc({ streak: 0, lastSent: { daily: '2026-11-16' } }), at(21)), null);
});

test('русские тексты', () => {
  assert.equal(decide(doc({ lang: 'ru' }), at(19)).title, 'Время для слов :)');
});

test('.ics: ежедневное событие с будильником, без чешских букв', () => {
  const ics = buildIcs({ hour: 19, minute: 30, title: 'Slovíčka — čas na slovíčka', url: 'https://example.com/', now: new Date(2026, 10, 16, 12) });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /RRULE:FREQ=DAILY/);
  assert.match(ics, /DTSTART:20261116T193000/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /\r\n/);
  assert.ok(!/[řůě]/.test(ics));
});
