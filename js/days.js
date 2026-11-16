// Учебный «день». Как в Anki, день сменяется не в полночь, а в 4:00 утра:
// если учишься в общаге в 1 ночи — это ещё «вчера», и серия не рвётся.

export const ROLLOVER_HOUR = 4;
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** Начало учебного дня (локальное время), в который попадает момент ts. */
export function dayStart(ts = Date.now()) {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), ROLLOVER_HOUR);
  if (d < start) start.setDate(start.getDate() - 1);
  return start.getTime();
}

/** Конец учебного дня (= начало следующего). */
export function dayEnd(ts = Date.now()) {
  const s = new Date(dayStart(ts));
  s.setDate(s.getDate() + 1);
  return s.getTime();
}

/** Ключ дня 'YYYY-MM-DD' — для статистики и серии. */
export function dayKey(ts = Date.now()) {
  const d = new Date(dayStart(ts));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Сдвиг ключа дня на n дней (n может быть отрицательным). */
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Сколько учебных дней между двумя моментами (b - a). */
export function daysBetween(a, b) {
  return Math.round((dayStart(b) - dayStart(a)) / DAY);
}
