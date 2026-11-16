// Игровые механики: опыт (XP), уровни, достижения. Чистые функции (тесты: tests/gamify.test.js).
//
// XP хранится прямо в записи журнала (review.xp) — поэтому он синхронизируется вместе с журналом
// и одинаков на всех устройствах. Для старых записей без xp считаем по формуле.

import { dayKey } from './days.js';

const BASE_XP = { 1: 2, 2: 6, 3: 10, 4: 12 };
const MODE_MULT = { cards: 1, typing: 1.5, grammar: 1.5, test: 0.8 };

/** XP за один ответ. combo — сколько верных подряд ДО этого ответа. */
export function xpFor({ grade, mode = 'cards', typeBefore, diacritic = false }, combo = 0) {
  let xp = BASE_XP[grade] ?? 0;
  xp *= MODE_MULT[mode] ?? 1;
  if (typeBefore === 'new') xp += 5;              // новое слово — бонус за смелость
  if (grade > 1 && !diacritic && combo >= 4) xp += Math.min(10, Math.floor(combo / 5) * 2 + 2); // комбо-бонус
  return Math.round(xp);
}

export const totalXp = (reviews) => reviews.reduce((s, r) => s + (r.xp ?? xpFor(r)), 0);

/** Сколько всего XP нужно, чтобы ДОСТИЧЬ уровня L: 0, 100, 300, 600, 1000, … */
export const xpForLevel = (L) => 50 * L * (L - 1);

export function levelInfo(xp) {
  let L = 1;
  while (xpForLevel(L + 1) <= xp) L++;
  const from = xpForLevel(L), to = xpForLevel(L + 1);
  return { level: L, xp, into: xp - from, need: to - from, progress: (xp - from) / (to - from) };
}

const TITLES = [
  [1, 'Nováčik', 'Новичок'],
  [3, 'Turista', 'Турист'],
  [5, 'Cestovateľ', 'Путешественник'],
  [8, 'Študent', 'Студент'],
  [12, 'Pokročilý', 'Продвинутый'],
  [16, 'Znalec', 'Знаток'],
  [20, 'Majster slovíčok', 'Мастер слов'],
  [30, 'Legenda', 'Легенда'],
];
export function levelTitle(level, lang = 'sk') {
  const row = [...TITLES].reverse().find(([l]) => level >= l);
  return lang === 'ru' ? row[2] : row[1];
}

/**
 * Сводка для проверки достижений.
 * @param reviews  журнал ответов
 * @param sessions сессии (с maxCombo, typed, diaErr)
 * @param notes    слова (active)
 * @param cards    карточки
 * @param streakBest лучшая серия дней
 */
export function achievementStats({ reviews = [], sessions = [], notes = [], cards = [], streakBest = 0 }) {
  let typedOk = 0, grammarOk = 0, night = false, early = false;
  for (const r of reviews) {
    if (r.mode === 'typing' && r.grade >= 3 && !r.diacritic) typedOk++;
    if (r.mode === 'grammar' && r.grade > 1) grammarOk++;
    const hour = new Date(r.ts).getHours();
    if (hour >= 23 || hour < 4) night = true;
    if (hour >= 5 && hour < 7) early = true;
  }
  return {
    reviews: reviews.length,
    sessions: sessions.filter((s) => s.count > 0).length,
    streakBest,
    maxCombo: Math.max(0, ...sessions.map((s) => s.maxCombo || 0)),
    cleanSession: sessions.some((s) => (s.typed || 0) >= 10 && (s.diaErr || 0) === 0),
    typedOk, grammarOk, night, early,
    activeWords: notes.filter((n) => n.active).length,
    imported: notes.some((n) => n.source === 'anki'),
    mature: cards.filter((c) => c.type === 'review' && c.interval >= 21 && !c.suspended).length,
    level: levelInfo(totalXp(reviews)).level,
    days: new Set(reviews.map((r) => dayKey(r.ts))).size,
  };
}

// Значки — текстовые, в стиле терминала (никаких эмодзи).
export const ACHIEVEMENTS = [
  { id: 'first', face: '>_', sk: 'Prvé kroky', ru: 'Первые шаги', dsk: 'Dokonči prvé sedenie', dru: 'Закончи первую сессию', test: (s) => s.sessions >= 1 },
  { id: 'streak3', face: '3d', sk: 'Rozbeh', ru: 'Разгон', dsk: 'Séria 3 dni', dru: 'Серия 3 дня', test: (s) => s.streakBest >= 3 },
  { id: 'streak7', face: '7d', sk: 'Týždeň v kuse', ru: 'Неделя подряд', dsk: 'Séria 7 dní', dru: 'Серия 7 дней', test: (s) => s.streakBest >= 7 },
  { id: 'streak30', face: '30d', sk: 'Mesiac v kuse', ru: 'Месяц подряд', dsk: 'Séria 30 dní', dru: 'Серия 30 дней', test: (s) => s.streakBest >= 30 },
  { id: 'streak100', face: '100d', sk: 'Železná vôľa', ru: 'Железная воля', dsk: 'Séria 100 dní', dru: 'Серия 100 дней', test: (s) => s.streakBest >= 100 },
  { id: 'rev100', face: '100', sk: 'Stovka', ru: 'Сотня', dsk: '100 odpovedí', dru: '100 ответов', test: (s) => s.reviews >= 100 },
  { id: 'rev1000', face: '1k', sk: 'Tisícka', ru: 'Тысяча', dsk: '1000 odpovedí', dru: '1000 ответов', test: (s) => s.reviews >= 1000 },
  { id: 'rev5000', face: '5k', sk: 'Maratónec', ru: 'Марафонец', dsk: '5000 odpovedí', dru: '5000 ответов', test: (s) => s.reviews >= 5000 },
  { id: 'words50', face: 'Aa', sk: 'Slovná zásoba', ru: 'Словарный запас', dsk: '50 slov v učení', dru: '50 слов в обучении', test: (s) => s.activeWords >= 50 },
  { id: 'words300', face: 'AZ', sk: 'Knihomoľ', ru: 'Книжный червь', dsk: '300 slov v učení', dru: '300 слов в обучении', test: (s) => s.activeWords >= 300 },
  { id: 'mature25', face: '**', sk: 'Zrelé ovocie', ru: 'Спелые плоды', dsk: '25 zrelých kariet (≥ 21 d)', dru: '25 зрелых карточек (≥ 21 д)', test: (s) => s.mature >= 25 },
  { id: 'mature200', face: '***', sk: 'Sad', ru: 'Сад', dsk: '200 zrelých kariet', dru: '200 зрелых карточек', test: (s) => s.mature >= 200 },
  { id: 'typed100', face: 'ä.', sk: 'Pisár', ru: 'Писарь', dsk: '100 správne napísaných slov', dru: '100 верно написанных слов', test: (s) => s.typedOk >= 100 },
  { id: 'clean', face: 'á✓', sk: 'Čistá diakritika', ru: 'Чистая диакритика', dsk: 'Sedenie v Písaní (≥ 10) bez chyby v diakritike', dru: 'Сессия Písanie (≥ 10) без ошибок в диакритике', test: (s) => s.cleanSession },
  { id: 'combo10', face: 'x10', sk: 'Kombo', ru: 'Комбо', dsk: '10 správnych za sebou', dru: '10 верных подряд', test: (s) => s.maxCombo >= 10 },
  { id: 'combo25', face: 'x25', sk: 'Nezastaviteľný', ru: 'Неудержимый', dsk: '25 správnych za sebou', dru: '25 верных подряд', test: (s) => s.maxCombo >= 25 },
  { id: 'grammar50', face: '§', sk: 'Gramatik', ru: 'Грамматик', dsk: '50 správnych tvarov', dru: '50 верных форм', test: (s) => s.grammarOk >= 50 },
  { id: 'night', face: 'Zz', sk: 'Nočná sova', ru: 'Ночная сова', dsk: 'Učenie po 23:00', dru: 'Учёба после 23:00', test: (s) => s.night },
  { id: 'early', face: '^^', sk: 'Ranné vtáča', ru: 'Ранняя пташка', dsk: 'Učenie pred 7:00', dru: 'Учёба до 7:00', test: (s) => s.early },
  { id: 'import', face: '.apkg', sk: 'Archivár', ru: 'Архивариус', dsk: 'Importuj balíček z Anki', dru: 'Импортируй колоду Anki', test: (s) => s.imported },
  { id: 'level5', face: 'L5', sk: 'Level 5', ru: 'Уровень 5', dsk: 'Dosiahni level 5', dru: 'Достигни 5 уровня', test: (s) => s.level >= 5 },
  { id: 'level10', face: 'L10', sk: 'Level 10', ru: 'Уровень 10', dsk: 'Dosiahni level 10', dru: 'Достигни 10 уровня', test: (s) => s.level >= 10 },
  { id: 'level20', face: 'L20', sk: 'Level 20', ru: 'Уровень 20', dsk: 'Dosiahni level 20', dru: 'Достигни 20 уровня', test: (s) => s.level >= 20 },
];

export const unlockedIds = (stats) => ACHIEVEMENTS.filter((a) => a.test(stats)).map((a) => a.id);

/** Слово дня: детерминированно по дате (одно и то же весь день на всех устройствах). */
export function wordOfDay(notes, key = dayKey()) {
  const pool = notes.filter((n) => n.sk && n.ru);
  if (!pool.length) return null;
  let hsh = 2166136261;
  for (const ch of key) { hsh ^= ch.charCodeAt(0); hsh = Math.imul(hsh, 16777619) >>> 0; }
  const sorted = pool.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  return sorted[hsh % sorted.length];
}
