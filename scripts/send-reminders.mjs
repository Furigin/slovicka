// Рассылка push-напоминаний. Запускается GitHub Actions раз в час (.github/workflows/reminders.yml).
//
// Читает подписки users/*/push/* из Firestore (Admin SDK), решает по правилам
// js/reminder-rules.js, кому пора напомнить, и отправляет Web Push.
//
// Переменные окружения (секреты GitHub, в репозитории их нет):
//   FIREBASE_SERVICE_ACCOUNT — JSON сервисного аккаунта Firebase
//   VAPID_PRIVATE_KEY        — приватный VAPID-ключ (публичный — в js/push-config.js)
//   DRY_RUN=1                — ничего не отправлять, только показать решения
//   FIRESTORE_EMULATOR_HOST  — для теста на эмуляторе (тогда сервисный аккаунт не нужен)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { decide, localTime } from '../js/reminder-rules.js';
import { vapidPublicKey } from '../js/push-config.js';
import { firebaseConfig } from '../js/firebase-config.js';

const DRY = !!process.env.DRY_RUN;
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;

if (emulator) initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-slovicka' });
else {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Нет секрета FIREBASE_SERVICE_ACCOUNT');
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)), projectId: firebaseConfig?.projectId });
}
if (!DRY) {
  if (!vapidPublicKey || !process.env.VAPID_PRIVATE_KEY) throw new Error('Нет VAPID-ключей (npm run push:setup)');
  webpush.setVapidDetails('https://furigin.github.io/slovicka/', vapidPublicKey, process.env.VAPID_PRIVATE_KEY);
}

const db = getFirestore();
const now = Date.now();
const snap = await db.collectionGroup('push').get();
let sent = 0, skipped = 0, removed = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  const msg = decide(data, now);
  if (!msg) {
    skipped++;
    // В сухом режиме объясняем, почему пропустили (без адреса подписки и ключей)
    if (DRY) {
      const { hour, studyDay } = localTime(now, data.timeZone || 'Europe/Bratislava');
      console.log(`[dry] ${doc.ref.path}: пропуск — enabled=${!!data.enabled}, подписка=${!!data.subscription}, ` +
        `сейчас ${hour}:xx (${data.timeZone}), напомнить в ${data.reminderHour}, спасти серию в ${data.saverHour}, ` +
        `учился сегодня=${data.lastStudyDay === studyDay}, серия=${data.streak ?? 0}, уже отправлено=${JSON.stringify(data.lastSent || {})}`);
    }
    continue;
  }
  const payload = JSON.stringify({
    title: msg.title, body: msg.body, tag: `slovicka-${msg.kind}`, url: './#/learn',
    badge: data.dueByDay?.[msg.day] ?? undefined,
  });
  console.log(`${DRY ? '[dry] ' : ''}${doc.ref.path}: ${msg.kind} — ${msg.title} / ${msg.body}`);
  if (DRY) { sent++; continue; }
  try {
    await webpush.sendNotification(data.subscription, payload, { TTL: 3 * 3600, urgency: 'normal' });
    await doc.ref.set({ lastSent: { ...(data.lastSent || {}), [msg.kind]: msg.day } }, { merge: true });
    sent++;
  } catch (e) {
    // 404/410 — подписка больше не действует (удалили приложение, сменили телефон)
    if (e.statusCode === 404 || e.statusCode === 410) {
      await doc.ref.set({ enabled: false, disabledReason: `gone ${e.statusCode}` }, { merge: true });
      removed++;
    } else {
      console.error(`${doc.ref.path}: ошибка ${e.statusCode || ''} ${e.body || e.message}`);
    }
  }
}
console.log(`подписок: ${snap.size}, отправлено: ${sent}, пропущено: ${skipped}, отключено: ${removed}`);
