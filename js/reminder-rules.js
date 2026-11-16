// Когда и что отправить в push-напоминании. Чистая функция — используется сервером
// (scripts/send-reminders.mjs в GitHub Actions) и тестами (tests/reminders.test.js).
//
// Документ подписки (users/{uid}/push/{deviceId}):
//   { enabled, timeZone: 'Europe/Bratislava', lang: 'sk'|'ru', reminderHour: 19, saverHour: 21 | null,
//     lastStudyDay: '2026-11-16', streak: 5, dueByDay: { '2026-11-17': 12, … }, lastSent: { daily, saver } }

const ROLLOVER_HOUR = 4; // учебный день начинается в 4:00, как в приложении
const WINDOW_HOURS = 2;  // GitHub Actions по расписанию может опаздывать — окно 2 часа

/** Местное время в часовом поясе пользователя: { hour, studyDay } */
export function localTime(nowMs, timeZone) {
  const parts = (ms) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const p = parts(nowMs);
  const s = parts(nowMs - ROLLOVER_HOUR * 3600_000); // «учебный» день сдвинут на 4 часа
  return { hour: Number(p.hour), studyDay: `${s.year}-${s.month}-${s.day}` };
}

const inWindow = (hour, start) => start !== null && start !== undefined && hour >= start && hour < start + WINDOW_HOURS;

const TEXTS = {
  sk: {
    dailyTitle: 'Čas na slovíčka :)',
    daily: (due, streak) => `${due ? `Na dnes: ${due} kariet` : 'Pár minút stačí'}${streak ? ` · séria ${streak} d` : ''}`,
    saverTitle: (streak) => `Séria ${streak} d je v ohrození!`,
    saver: 'Stačí 5 minút, nech ju nestratíš <3',
  },
  ru: {
    dailyTitle: 'Время для слов :)',
    daily: (due, streak) => `${due ? `На сегодня: ${due} карт.` : 'Хватит пары минут'}${streak ? ` · серия ${streak} дн.` : ''}`,
    saverTitle: (streak) => `Серия ${streak} дн. под угрозой!`,
    saver: 'Хватит 5 минут, чтобы её сохранить <3',
  },
};

/**
 * Решить, что отправить сейчас. → { kind: 'daily'|'saver', title, body, day } или null.
 */
export function decide(doc, nowMs = Date.now()) {
  if (!doc?.enabled || !doc.subscription) return null;
  const { hour, studyDay } = localTime(nowMs, doc.timeZone || 'Europe/Bratislava');
  if (doc.lastStudyDay === studyDay) return null;           // сегодня уже учился — не дёргаем
  const T = TEXTS[doc.lang === 'ru' ? 'ru' : 'sk'];
  const sent = doc.lastSent || {};
  const streak = doc.streak || 0;

  // «Спаси серию» важнее обычного напоминания
  if (streak > 0 && inWindow(hour, doc.saverHour) && sent.saver !== studyDay) {
    return { kind: 'saver', title: T.saverTitle(streak), body: T.saver, day: studyDay };
  }
  if (inWindow(hour, doc.reminderHour) && sent.daily !== studyDay && sent.saver !== studyDay) {
    const due = doc.dueByDay?.[studyDay] ?? 0;
    return { kind: 'daily', title: T.dailyTitle, body: T.daily(due, streak), day: studyDay };
  }
  return null;
}
