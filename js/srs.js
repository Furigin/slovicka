// Интервальное повторение: SM-2 с шагами обучения (как в Anki).
// Чистые функции без DOM и базы — легко тестировать (tests/srs.test.js).
//
// Состояние карточки:
//   type      'new' | 'learning' | 'review' | 'relearning'
//   due       момент, когда карточку показать (мс)
//   interval  интервал в днях (для review)
//   ease      коэффициент лёгкости (2.5 на старте, минимум 1.3)
//   step      номер шага обучения
//   reps      сколько раз отвечали, lapses — сколько раз забыли
//
// Оценки: 1 Znova, 2 Ťažké, 3 Dobré, 4 Ľahké.

import { MIN, DAY, dayStart, daysBetween } from './days.js';

export const GRADES = [1, 2, 3, 4];
export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

export const SRS_DEFAULTS = {
  learningSteps: [1, 10],     // минуты
  relearningSteps: [10],      // минуты
  graduatingInterval: 1,      // дней
  easyInterval: 4,            // дней
  startingEase: 2.5,
  minEase: 1.3,
  easyBonus: 1.3,
  hardFactor: 1.2,
  maxInterval: 3650,          // дней
};

/** Пустое состояние новой карточки. */
export function newCardState() {
  return { type: 'new', due: 0, interval: 0, ease: 0, step: 0, reps: 0, lapses: 0, lastReview: 0 };
}

/** Момент «через n учебных дней» (начало того дня, 4:00). Учитывает переход на летнее время. */
export function dueInDays(now, n) {
  const d = new Date(dayStart(now));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Небольшой разброс интервалов, чтобы карточки не слипались в один день. */
function fuzz(ivl, rng) {
  if (ivl < 3) return ivl;
  const spread = Math.max(1, Math.round(ivl * 0.05));
  return ivl + Math.round((rng() * 2 - 1) * spread);
}

/** Задержка для «Ťažké» на шаге обучения. */
function hardDelay(steps, step) {
  if (step === 0 && steps.length > 1) return (steps[0] + steps[1]) / 2;
  if (steps.length === 1) return Math.min(steps[0] * 1.5, steps[0] + 24 * 60);
  return steps[step];
}

/**
 * Применить оценку к карточке. Возвращает НОВОЕ состояние (исходный объект не меняется).
 * @param card  объект карточки (с полями состояния)
 * @param grade 1..4
 * @param now   текущее время, мс
 * @param cfg   настройки (см. SRS_DEFAULTS)
 * @param rng   генератор случайных чисел (в тестах — () => 0.5, без разброса)
 */
export function schedule(card, grade, now = Date.now(), cfg = {}, rng = Math.random) {
  const c = { ...SRS_DEFAULTS, ...cfg };
  const s = { ...card, reps: (card.reps || 0) + 1, lastReview: now };

  // ----- Новые и в обучении / переобучении: шаги в минутах -----
  if (s.type === 'new' || s.type === 'learning' || s.type === 'relearning') {
    const relearn = s.type === 'relearning';
    const steps = (relearn ? c.relearningSteps : c.learningSteps).filter((x) => x > 0);
    if (s.type === 'new') { s.type = 'learning'; s.step = 0; s.ease = c.startingEase; }

    const graduate = (days) => {
      s.type = 'review';
      s.step = 0;
      s.interval = Math.min(c.maxInterval, Math.max(1, days));
      s.due = dueInDays(now, s.interval);
      return s;
    };

    // Нет шагов — сразу в повторение
    if (!steps.length) {
      return graduate(relearn ? s.interval : grade === EASY ? c.easyInterval : c.graduatingInterval);
    }

    if (grade === AGAIN) {
      s.step = 0;
      s.due = now + steps[0] * MIN;
      return s;
    }
    if (grade === HARD) {
      s.step = Math.min(s.step, steps.length - 1);
      s.due = now + hardDelay(steps, s.step) * MIN;
      return s;
    }
    if (grade === GOOD) {
      const nextStep = s.step + 1;
      if (nextStep >= steps.length) {
        return graduate(relearn ? s.interval : c.graduatingInterval);
      }
      s.step = nextStep;
      s.due = now + steps[nextStep] * MIN;
      return s;
    }
    // EASY — сразу выпускаем
    return graduate(relearn ? s.interval + 1 : c.easyInterval);
  }

  // ----- Повторение (review): интервалы в днях -----
  const ivl = Math.max(1, s.interval || 1);
  const ease = s.ease || c.startingEase;
  const late = Math.max(0, daysBetween(s.due || now, now)); // на сколько дней опоздали

  if (grade === AGAIN) {
    s.lapses = (s.lapses || 0) + 1;
    s.ease = Math.max(c.minEase, ease - 0.2);
    s.interval = 1; // после переобучения начинаем с 1 дня
    const steps = c.relearningSteps.filter((x) => x > 0);
    if (!steps.length) { s.due = dueInDays(now, 1); return s; }
    s.type = 'relearning';
    s.step = 0;
    s.due = now + steps[0] * MIN;
    return s;
  }

  const hardIvl = Math.max(ivl + 1, Math.round(ivl * c.hardFactor));
  const goodIvl = Math.max(hardIvl + 1, Math.round((ivl + late / 2) * ease));
  const easyIvl = Math.max(goodIvl + 1, Math.round((ivl + late) * ease * c.easyBonus));

  let next;
  if (grade === HARD) { next = hardIvl; s.ease = Math.max(c.minEase, ease - 0.15); }
  else if (grade === GOOD) { next = goodIvl; s.ease = ease; }
  else { next = easyIvl; s.ease = ease + 0.15; }

  s.interval = Math.min(c.maxInterval, Math.max(1, fuzz(next, rng)));
  s.due = dueInDays(now, s.interval);
  return s;
}

/**
 * Предпросмотр: что будет при каждой оценке (для подписей под кнопками).
 * Возвращает { 1: {ms, days, learning}, 2: …, 3: …, 4: … }.
 */
export function preview(card, now = Date.now(), cfg = {}) {
  const out = {};
  for (const g of GRADES) {
    const n = schedule(card, g, now, cfg, () => 0.5);
    const learning = n.type === 'learning' || n.type === 'relearning';
    out[g] = { ms: n.due - now, days: n.interval, learning };
  }
  return out;
}

/** «1 min», «10 min», «3 h», «4 d», «2,5 mes.», «1,2 r.» (или по-русски). */
export function formatInterval(p, lang = 'sk') {
  const L = lang === 'ru'
    ? { min: 'мин', h: 'ч', d: 'д', mo: 'мес.', y: 'г.' }
    : { min: 'min', h: 'h', d: 'd', mo: 'mes.', y: 'r.' };
  const fmt = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  if (p.learning) {
    const m = Math.max(1, Math.round(p.ms / MIN));
    if (m < 60) return `${m} ${L.min}`;
    const h = m / 60;
    if (h < 24) return `${fmt(h)} ${L.h}`;
    return `${fmt(h / 24)} ${L.d}`;
  }
  const d = p.days;
  if (d < 30) return `${d} ${L.d}`;
  if (d < 365) return `${fmt(d / 30)} ${L.mo}`;
  return `${fmt(d / 365)} ${L.y}`;
}

/** Зрелость карточки для статистики. */
export function maturity(card) {
  if (card.type === 'new') return 'new';
  if (card.type === 'learning' || card.type === 'relearning') return 'learning';
  return card.interval >= 21 ? 'mature' : 'young';
}

/** Перевод настроек приложения в конфиг SRS. */
export function srsConfig(settings) {
  return {
    learningSteps: settings.learningSteps,
    relearningSteps: settings.relearningSteps,
    graduatingInterval: settings.graduatingInterval,
    easyInterval: settings.easyInterval,
    maxInterval: settings.maxInterval,
  };
}

export { DAY };
