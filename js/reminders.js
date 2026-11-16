// Напоминания: значок с числом на иконке, событие в Календаре (.ics) и push-уведомления.
//
// Push на iPhone работают только у приложения, добавленного «На экран Домой» (iOS 16.4+).
// Отправляет их не приложение, а GitHub Actions раз в час (scripts/send-reminders.mjs):
// здесь мы только подписываемся и сохраняем в Firestore, когда напоминать и учился ли ты сегодня.
import * as db from './db.js';
import { settings } from './settings.js';
import { vapidPublicKey } from './push-config.js';
import { buildIcs } from './ics.js';
import { dayKey, addDays } from './days.js';
import { forecast, activityByDay, streak as calcStreak } from './stats-calc.js';
import { countToday, todayFromLog } from './queue.js';
import * as store from './store.js';
import { uid } from './dom.js';

export const pushConfigured = () => !!vapidPublicKey;
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ---------- Значок на иконке приложения ----------
/** Сколько карточек осталось на сегодня (для значка). */
async function remainingToday() {
  const [cards, today] = await Promise.all([store.studyCards('all'), store.todayReviews()]);
  const c = countToday(cards, Date.now(), todayFromLog(today, 'vocab'), settings());
  return c.new + c.learning + c.review;
}

export async function updateBadge() {
  if (!('setAppBadge' in navigator)) return;
  try {
    const n = await remainingToday();
    if (n > 0) await navigator.setAppBadge(n); else await navigator.clearAppBadge();
  } catch { /* нет разрешения на уведомления — значок недоступен */ }
}

// ---------- Календарь ----------
export async function addToCalendar() {
  const s = settings();
  const ru = s.lang === 'ru';
  const ics = buildIcs({
    hour: s.reminderHour ?? 19, minute: 0,
    title: ru ? 'Slovíčka — время для слов :)' : 'Slovíčka — čas na slovíčka :)',
    description: ru ? 'Пара минут в день — и серия не прервётся.' : 'Pár minút denne a séria sa nepreruší.',
    url: location.href.split('#')[0],
  });
  const blob = new Blob([ics], { type: 'text/calendar' });
  const file = new File([blob], 'slovicka-pripomienka.ics', { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  // Safari открывает .ics и предлагает «Добавить в Календарь»
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'slovicka-pripomienka.ics';
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
}

// ---------- Push ----------
async function deviceId() {
  let id = await db.getMeta('deviceId');
  if (!id) { id = uid('dev-'); await db.setMeta('deviceId', id); }
  return id;
}

function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Состояние для сервера: учился ли сегодня, серия, сколько карточек по дням. */
async function studyState() {
  const [reviews, sessions, cards] = await Promise.all([db.getAll('reviews'), db.getAll('sessions'), db.getAll('cards')]);
  const act = activityByDay(reviews, sessions);
  const st = calcStreak(act, settings().streakMinCards);
  const today = dayKey();
  const fc = forecast(cards.filter((c) => !c.suspended), 7);
  const dueByDay = {};
  fc.forEach((n, i) => { dueByDay[addDays(today, i)] = n; });
  dueByDay[today] = (await remainingToday()) || fc[0];
  // «учился сегодня» = день уже засчитан в серию; иначе напоминание ещё нужно
  return { lastStudyDay: st.todayDone ? today : null, streak: st.current, dueByDay };
}

/**
 * Включить push. ВАЖНО: вызывать прямо из обработчика тапа — iOS спрашивает разрешение
 * только в ответ на действие пользователя.
 * → 'ok' | 'denied' | 'not-installed' | 'unsupported' | 'not-configured' | 'login'
 */
export async function enablePush() {
  if (!pushConfigured()) return 'not-configured';
  if (!pushSupported()) return isIos() && !isStandalone() ? 'not-installed' : 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const sync = await import('./sync.js');
  if (!sync.currentUser()) return 'login';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription()
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapidPublicKey) });
  await db.setMeta('pushEnabled', true);
  await sync.setPushDoc(await deviceId(), {
    enabled: true,
    subscription: JSON.parse(JSON.stringify(sub)),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...pushPrefs(),
    ...(await studyState()),
    updatedAt: Date.now(),
  });
  updateBadge();
  return 'ok';
}

export async function disablePush() {
  await db.setMeta('pushEnabled', false);
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
  } catch { /* уже отписаны */ }
  const sync = await import('./sync.js');
  if (sync.currentUser()) await sync.setPushDoc(await deviceId(), { enabled: false, updatedAt: Date.now() });
}

export const pushEnabled = async () => !!(await db.getMeta('pushEnabled')) && Notification?.permission === 'granted';

const pushPrefs = () => {
  const s = settings();
  return { lang: s.lang, reminderHour: s.reminderHour ?? 19, saverHour: s.saverHour ?? null };
};

let lastPushUpdate = 0;
/** Обновить в облаке состояние для напоминаний (после сессии, при сворачивании; не чаще раза в минуту). */
export async function refreshPushState(force = false) {
  if (!pushConfigured() || !(await db.getMeta('pushEnabled'))) return;
  if (!force && Date.now() - lastPushUpdate < 60_000) return;
  lastPushUpdate = Date.now();
  try {
    const sync = await import('./sync.js');
    if (!sync.currentUser()) return;
    await sync.setPushDoc(await deviceId(), { ...pushPrefs(), ...(await studyState()), updatedAt: Date.now() });
  } catch (e) { console.warn('push state', e); }
}

/** Вызывается после каждой сессии. */
export async function afterStudy() {
  updateBadge();
  refreshPushState(true);
}
