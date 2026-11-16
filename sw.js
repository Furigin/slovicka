// Service Worker: офлайн-режим, статика cache-first.
// Список файлов и версия обновляются командой `npm run sw` (scripts/gen-sw.mjs).
// Новая версия НЕ активируется сама: приложение показывает плашку
// «Je dostupná nová verzia — obnoviť», и только по нажатию присылает SKIP_WAITING.

// <assets>
const VERSION = 'b5c6cfbf03e0';
const ASSETS = [
  './',
  'css/base.css',
  'css/components.css',
  'css/fonts.css',
  'css/views.css',
  'data/grammar.json',
  'fonts/inter-cyrillic-400-normal.woff2',
  'fonts/inter-cyrillic-600-normal.woff2',
  'fonts/inter-latin-400-normal.woff2',
  'fonts/inter-latin-600-normal.woff2',
  'fonts/inter-latin-ext-400-normal.woff2',
  'fonts/inter-latin-ext-600-normal.woff2',
  'fonts/jetbrains-mono-cyrillic-400-normal.woff2',
  'fonts/jetbrains-mono-cyrillic-700-normal.woff2',
  'fonts/jetbrains-mono-latin-400-normal.woff2',
  'fonts/jetbrains-mono-latin-700-normal.woff2',
  'fonts/jetbrains-mono-latin-ext-400-normal.woff2',
  'fonts/jetbrains-mono-latin-ext-700-normal.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'js/app.js',
  'js/backup-format.js',
  'js/backup.js',
  'js/charts.js',
  'js/compare.js',
  'js/days.js',
  'js/db.js',
  'js/diacritics.js',
  'js/distractors.js',
  'js/dom.js',
  'js/firebase-config.js',
  'js/fx.js',
  'js/gamify.js',
  'js/grammar-core.js',
  'js/grammar.js',
  'js/i18n.js',
  'js/icons.js',
  'js/ics.js',
  'js/import-apkg.js',
  'js/modes/cards.js',
  'js/modes/common.js',
  'js/modes/grammar.js',
  'js/modes/test.js',
  'js/modes/typing.js',
  'js/progress.js',
  'js/push-config.js',
  'js/queue.js',
  'js/reminder-rules.js',
  'js/reminders.js',
  'js/router.js',
  'js/settings.js',
  'js/srs.js',
  'js/stats-calc.js',
  'js/store.js',
  'js/sync.js',
  'js/textutil.js',
  'js/ui.js',
  'js/views/decks.js',
  'js/views/dictionary.js',
  'js/views/grammar-editor.js',
  'js/views/import.js',
  'js/views/learn.js',
  'js/views/motivation-panel.js',
  'js/views/note-form.js',
  'js/views/session.js',
  'js/views/settings.js',
  'js/views/stats.js',
  'manifest.webmanifest',
  'vendor/firebase.js',
  'vendor/fzstd.js',
  'vendor/idb.js',
  'vendor/jszip.min.js',
  'vendor/sql-wasm.js',
  'vendor/sql-wasm.wasm',
];
// </assets>

const CACHE = `slovicka-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' — мимо HTTP-кэша браузера, чтобы не закэшировать старые файлы
    await cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('slovicka-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase и прочее — напрямую в сеть

  // Навигация (открытие приложения) — всегда index.html из кэша
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html', { ignoreSearch: true }) || await caches.match('./');
      try { return cached || await fetch(req); } catch { return cached || Response.error(); }
    })());
    return;
  }

  // Статика — cache-first, неизвестные файлы докладываем в кэш
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  })());
});

// ---------- Push-напоминания (присылает GitHub Actions, см. scripts/send-reminders.mjs) ----------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  const title = data.title || 'Slovíčka';
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: data.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: data.tag || 'slovicka-reminder',  // новое напоминание заменяет старое, а не копится
      data: { url: data.url || './#/learn' },
    });
    if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
      try { await self.navigator.setAppBadge(data.badge); } catch { /* нет разрешения */ }
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); return c.navigate?.(url); }
    }
    return self.clients.openWindow(url);
  })());
});

