// Файл календаря (.ics) с ежедневным напоминанием — работает без сервера:
// iPhone добавляет повторяющееся событие в «Календарь», и уведомление приходит от него.

const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

/**
 * @param hour, minute  время напоминания (местное)
 * @param title         заголовок события
 * @param url           ссылка на приложение
 */
export function buildIcs({ hour = 19, minute = 0, title, description = '', url, now = new Date() }) {
  const d = new Date(now);
  // если сегодня время уже прошло — начинаем с завтра
  if (d.getHours() > hour || (d.getHours() === hour && d.getMinutes() >= minute)) d.setDate(d.getDate() + 1);
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Slovicka//Pripomienka//SK',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:slovicka-daily-${date}-${pad(hour)}${pad(minute)}@slovicka`,
    `DTSTAMP:${stamp}`,
    // «плавающее» местное время (без часового пояса) — событие всегда в 19:00 там, где ты есть
    `DTSTART:${date}T${pad(hour)}${pad(minute)}00`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description || url)}`,
    url ? `URL:${url}` : null,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}
