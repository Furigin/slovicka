// Расчёты для статистики и серии дней. Чистые функции (тесты: tests/stats.test.js).
import { dayKey, addDays, dayStart, dayEnd, DAY } from './days.js';
import { maturity } from './srs.js';

/**
 * Активность по дням из журнала ответов и сессий.
 * → Map('YYYY-MM-DD' → { cards, sessions, correct, ms, newCards, diacritic, typed })
 */
export function activityByDay(reviews, sessions = []) {
  const map = new Map();
  const get = (k) => {
    if (!map.has(k)) map.set(k, { cards: 0, sessions: 0, correct: 0, ms: 0, newCards: 0, diacritic: 0, typed: 0 });
    return map.get(k);
  };
  for (const r of reviews) {
    const d = get(dayKey(r.ts));
    d.cards++;
    if (r.grade > 1) d.correct++;
    d.ms += Math.min(r.ms || 0, 60_000); // не учитываем «завис на карточке 10 минут»
    if (r.typeBefore === 'new') d.newCards++;
    if (r.mode === 'typing' || r.mode === 'grammar') {
      d.typed++;
      if (r.diacritic) d.diacritic++;
    }
  }
  for (const s of sessions) if (s.end && s.count > 0) get(dayKey(s.end)).sessions++;
  return map;
}

/** День засчитан в серию: ≥ 1 завершённая сессия или ≥ minCards карточек. */
export const dayCounts = (d, minCards) => !!d && (d.sessions >= 1 || d.cards >= minCards);

/**
 * Серия дней подряд.
 * Если сегодня ещё не учился — серия считается до вчера (и не «сгорает» до конца дня).
 */
export function streak(activity, minCards, now = Date.now()) {
  const today = dayKey(now);
  const todayDone = dayCounts(activity.get(today), minCards);
  let current = 0;
  let k = todayDone ? today : addDays(today, -1);
  while (dayCounts(activity.get(k), minCards)) { current++; k = addDays(k, -1); }

  let best = 0, run = 0, prev = null;
  for (const key of [...activity.keys()].sort()) {
    if (!dayCounts(activity.get(key), minCards)) { run = 0; prev = key; continue; }
    run = prev && addDays(prev, 1) === key && run > 0 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return { current, best: Math.max(best, current), todayDone };
}

/** Распределение карточек: новые / в обучении / молодые / зрелые. */
export function distribution(cards) {
  const out = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const c of cards) if (!c.suspended) out[maturity(c)]++;
  return out;
}

/** Нагрузка повторений на n дней вперёд (индекс 0 — сегодня, включая просроченные). */
export function forecast(cards, days = 30, now = Date.now()) {
  const out = new Array(days).fill(0);
  const start = dayStart(now);
  for (const c of cards) {
    if (c.suspended || c.type === 'new') continue;
    // просроченные и сегодняшние — в «сегодня»; Math.round сглаживает переход на летнее время
    const idx = c.due < dayEnd(now) ? 0 : Math.round((dayStart(c.due) - start) / DAY);
    if (idx >= 0 && idx < days) out[idx]++;
  }
  return out;
}

/** Сводка за сегодня. */
export function todaySummary(activity, now = Date.now()) {
  const d = activity.get(dayKey(now)) || { cards: 0, correct: 0, ms: 0, newCards: 0 };
  return {
    reviewed: d.cards,
    newCards: d.newCards,
    accuracy: d.cards ? d.correct / d.cards : null,
    ms: d.ms,
  };
}
