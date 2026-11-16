// Синхронизация с Firebase (Firestore + вход по email/паролю).
//
// Схема: основная база — IndexedDB на устройстве (работает офлайн и мгновенно).
// Облако — копия и мост между устройствами:
//   users/{uid}/items/{store}~{id} = { store, id, deleted, updatedAt, data, syncedAt }
//
//  push: всё из outbox (локальные изменения) → пачками по 400 в Firestore;
//  pull: только документы с syncedAt > времени последней синхронизации (экономим чтения);
//  конфликт: побеждает запись с более поздним updatedAt.
// Картинки (media) не синхронизируются: Cloud Storage требует платный тариф Blaze.

import { firebaseConfig } from './firebase-config.js';
import * as db from './db.js';
import { h, mount } from './dom.js';
import { t, ago } from './i18n.js';
import { toast } from './ui.js';
import { reloadSettings } from './settings.js';

let fb = null, auth = null, fs = null;
let user = null;
let running = null;
let timer = null;
let lastError = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const BATCH = 400;
const PAGE = 500;

export const isConfigured = () => !!firebaseConfig;
export const currentUser = () => user;

let initPromise = null;
export function initSync() {
  if (!firebaseConfig) return Promise.resolve();
  return (initPromise ||= init());
}

async function init() {
  const mod = await import('../vendor/firebase.js');
  fb = mod;
  const app = fb.initializeApp(firebaseConfig);
  auth = fb.initializeAuth(app, { persistence: [fb.indexedDBLocalPersistence, fb.browserLocalPersistence] });
  fs = fb.getFirestore(app);
  // Только для автотеста синхронизации (scripts/e2e-sync.mjs) — локальный эмулятор Firebase
  if (firebaseConfig.emulator) {
    fb.connectAuthEmulator(auth, `http://${firebaseConfig.emulator}:9099`, { disableWarnings: true });
    fb.connectFirestoreEmulator(fs, firebaseConfig.emulator, 8080);
  }

  fb.onAuthStateChanged(auth, (u) => {
    user = u;
    emit();
    if (u) syncSoon(500);
  });
  // Автосинхронизация: после изменений (с задержкой), при появлении сети и уходе в фон
  db.onLocalChange(() => syncSoon(20_000));
  window.addEventListener('online', () => syncSoon(1000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncNow().catch(() => {});
    else syncSoon(1500);
  });
}

/** Отложенная синхронизация (несколько изменений подряд → одна отправка). */
export function syncSoon(delay = 4000) {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow().catch(() => {}), delay);
}

export async function syncNow({ manual = false } = {}) {
  if (!user || !fs) return null;
  if (!navigator.onLine) { if (manual) toast(t('sync.offline')); return null; }
  if (running) return running;
  running = (async () => {
    try {
      const pulled = await pull();
      const pushed = await push();
      await db.setMeta('lastSyncAt', Date.now());
      lastError = null;
      if (manual) toast(t('sync.ok'));
      if (pulled > 0) {
        await reloadSettings();
        window.dispatchEvent(new CustomEvent('slovicka:synced', { detail: { pulled, pushed } }));
      }
      return { pulled, pushed };
    } catch (e) {
      lastError = e;
      console.warn('sync', e);
      if (manual) toast(`${t('error')}: ${e.code || e.message}`, { error: true });
      throw e;
    } finally {
      running = null;
      emit();
    }
  })();
  return running;
}

const itemsCol = () => fb.collection(fs, 'users', user.uid, 'items');

async function push() {
  const entries = await db.outboxAll();
  let n = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH);
    const batch = fb.writeBatch(fs);
    for (const e of chunk) {
      const ref = fb.doc(itemsCol(), `${e.store}~${e.id}`);
      const rec = e.deleted ? null : await db.get(e.store, e.id);
      if (!rec) {
        batch.set(ref, { store: e.store, id: e.id, deleted: true, updatedAt: e.at, syncedAt: fb.serverTimestamp() });
      } else {
        batch.set(ref, {
          store: e.store, id: e.id, deleted: false, updatedAt: rec.updatedAt || e.at,
          data: JSON.parse(JSON.stringify(rec)), // убираем undefined (Firestore их не принимает)
          syncedAt: fb.serverTimestamp(),
        });
      }
    }
    await batch.commit();
    await db.outboxAck(chunk);
    n += chunk.length;
  }
  return n;
}

async function pull() {
  const saved = await db.getMeta(`lastPull:${user.uid}`, null);
  let since = saved ? new fb.Timestamp(saved.s, saved.ns) : null;
  let cursor = null;
  let total = 0;
  for (;;) {
    const parts = [itemsCol()];
    if (since) parts.push(fb.where('syncedAt', '>', since));
    parts.push(fb.orderBy('syncedAt'));
    if (cursor) parts.push(fb.startAfter(cursor));
    parts.push(fb.limit(PAGE));
    const snap = await fb.getDocs(fb.query(...parts));
    const items = snap.docs.map((d) => d.data()).filter((x) => db.SYNCED_STORES.includes(x.store));
    total += await db.applyRemote(items);
    if (snap.docs.length) {
      cursor = snap.docs[snap.docs.length - 1];
      const ts = cursor.data().syncedAt;
      if (ts) await db.setMeta(`lastPull:${user.uid}`, { s: ts.seconds, ns: ts.nanoseconds });
    }
    if (snap.docs.length < PAGE) break;
  }
  return total;
}

// ---------- Интерфейс в настройках ----------
const AUTH_ERRORS = {
  'auth/invalid-credential': { sk: 'Nesprávny e-mail alebo heslo.', ru: 'Неверный e-mail или пароль.' },
  'auth/invalid-email': { sk: 'Nesprávny formát e-mailu.', ru: 'Неверный формат e-mail.' },
  'auth/email-already-in-use': { sk: 'Účet s týmto e-mailom už existuje.', ru: 'Аккаунт с таким e-mail уже есть.' },
  'auth/weak-password': { sk: 'Heslo musí mať aspoň 6 znakov.', ru: 'Пароль должен быть не короче 6 символов.' },
  'auth/network-request-failed': { sk: 'Nie je pripojenie k sieti.', ru: 'Нет подключения к сети.' },
  'auth/too-many-requests': { sk: 'Príliš veľa pokusov, skús neskôr.', ru: 'Слишком много попыток, попробуй позже.' },
};
const authError = (e) => {
  const lang = document.documentElement.lang === 'ru' ? 'ru' : 'sk';
  return AUTH_ERRORS[e.code]?.[lang] || e.message;
};

export function renderAccountPanel(el) {
  const draw = async () => {
    if (!el.isConnected && el.dataset.drawn) { listeners.delete(draw); return; }
    el.dataset.drawn = '1';
    if (!firebaseConfig) {
      mount(el, h('p', { class: 'small dim', style: { margin: 0 } }, t('sync.notConfigured')));
      return;
    }
    if (!fb) { mount(el, h('p', { class: 'small dim' }, t('loading'))); return; }

    if (!user) {
      const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', placeholder: 'meno@example.com', autocapitalize: 'off', inputmode: 'email' });
      const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: '••••••' });
      const msg = h('p', { class: 'small', style: { color: 'var(--again)', margin: 0 }, hidden: true });
      const act = (fn) => async () => {
        msg.hidden = true;
        try { await fn(); } catch (e) { msg.textContent = authError(e); msg.hidden = false; }
      };
      mount(el, h('form', { class: 'stack', onsubmit: (e) => e.preventDefault() },
        h('p', { class: 'small dim', style: { margin: 0 } }, t('sync.mediaNote')),
        h('label', { class: 'field' }, h('span', {}, t('sync.email')), email),
        h('label', { class: 'field' }, h('span', {}, t('sync.password')), pass),
        msg,
        h('div', { class: 'row' },
          h('button', { type: 'submit', class: 'btn primary grow', onclick: act(() => fb.signInWithEmailAndPassword(auth, email.value.trim(), pass.value)) }, t('sync.login')),
          h('button', { type: 'button', class: 'btn grow', onclick: act(() => fb.createUserWithEmailAndPassword(auth, email.value.trim(), pass.value)) }, t('sync.register'))),
        h('button', {
          type: 'button', class: 'btn ghost block small',
          onclick: act(async () => { await fb.sendPasswordResetEmail(auth, email.value.trim()); toast(t('sync.resetSent')); }),
        }, t('sync.reset'))));
      return;
    }

    const [lastSync, pending] = await Promise.all([db.getMeta('lastSyncAt'), db.count('outbox')]);
    mount(el, h('div', { class: 'stack' },
      h('p', { style: { margin: 0 } }, t('sync.loggedAs', { email: user.email })),
      h('p', { class: 'small dim', style: { margin: 0 } },
        t('sync.last', { when: lastSync ? ago(lastSync) : t('sync.never') }),
        pending ? ` · ${t('sync.pending', { n: pending })}` : '',
        running ? ' · …' : ''),
      lastError && h('p', { class: 'small', style: { color: 'var(--again)', margin: 0 } }, lastError.code || lastError.message),
      h('p', { class: 'tiny faint', style: { margin: 0 } }, t('sync.mediaNote')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary grow', disabled: !!running, onclick: () => syncNow({ manual: true }).catch(() => {}) }, t('sync.now')),
        h('button', { class: 'btn grow', onclick: () => fb.signOut(auth) }, t('sync.logout')))));
  };
  listeners.add(draw);
  draw();
  // Если Firebase ещё грузится — перерисуем, когда загрузится
  if (firebaseConfig && !fb) initSync().then(draw).catch((e) => mount(el, h('p', { class: 'small' }, String(e))));
}
