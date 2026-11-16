// Точка входа: база → настройки → стартовые данные → таб-панель → роутер → service worker → синхрон.
import { openDB, requestPersistence } from './db.js';
import { loadSettings, onSettings } from './settings.js';
import { seedIfEmpty } from './store.js';
import { h, mount } from './dom.js';
import { ICONS } from './icons.js';
import { t } from './i18n.js';
import { startRouter, onRoute, render, currentRoute, routeTab } from './router.js';
import { toast } from './ui.js';
import { openNoteForm } from './views/note-form.js'; // статично: фокус поля в том же тапе (iOS)

const TABS = [
  { name: 'learn', icon: 'learn', label: 'tab.learn' },
  { name: 'dict', icon: 'dict', label: 'tab.dict' },
  { name: 'stats', icon: 'stats', label: 'tab.stats' },
  { name: 'settings', icon: 'settings', label: 'tab.settings' },
];

function renderTabbar() {
  const active = routeTab(currentRoute());
  mount(document.getElementById('tabbar'), TABS.map((tab) => h('a', {
    href: `#/${tab.name}`,
    'aria-current': tab.name === active ? 'page' : null,
  }, h('span', { html: ICONS[tab.icon], style: { display: 'contents' } }), t(tab.label))));
}

/** Плавающая кнопка «+» (добавить слово в 2 тапа) — на экранах «Učiť sa» и «Slovník». */
function renderFab(routeName) {
  document.querySelector('.fab')?.remove();
  if (!['learn', 'dict'].includes(routeName)) return;
  const fab = h('button', {
    class: 'fab', 'aria-label': t('note.add'), html: ICONS.plus,
    onclick: () => openNoteForm({ onSaved: () => { if (currentRoute() !== 'session') render(); } }),
  });
  document.getElementById('app').append(fab);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // Был ли SW до этой загрузки. Если нет — это первая установка, а не обновление:
  // ни плашку, ни перезагрузку показывать не нужно.
  const hadController = !!navigator.serviceWorker.controller;
  let shown = false;
  const showUpdate = (worker) => {
    if (shown) return;
    shown = true;
    toast(t('update.available'), {
      timeout: 0,
      action: { label: t('update.reload'), run: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
    });
  };
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && hadController) showUpdate(w);
      });
    });
    // PWA на iOS почти не перезагружается — проверяем обновления при возвращении в приложение
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('SW не зарегистрирован', e));

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    location.reload();
  });
}

async function main() {
  await openDB();
  await loadSettings();
  await seedIfEmpty();
  requestPersistence(); // не ждём: на iOS может вернуть false — это нормально

  onRoute((name) => { renderTabbar(); renderFab(name); });
  onSettings((s, patch) => {
    if ('lang' in patch || Object.keys(patch).length === 0) { renderTabbar(); render(); }
  });

  // Пришли данные с другого устройства — перерисовать экран (кроме идущей сессии)
  window.addEventListener('slovicka:synced', () => { if (currentRoute() !== 'session') render(); });

  await startRouter();
  registerServiceWorker();

  // Значок с числом карточек на иконке и состояние для push — при сворачивании приложения
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    import('./reminders.js').then((m) => { m.updateBadge(); m.refreshPushState(); }).catch(() => {});
  });

  // Облачная синхронизация — только если настроен Firebase (загружается лениво)
  import('./sync.js').then((m) => m.initSync()).catch((e) => console.warn('sync', e));
}

main().catch((e) => {
  console.error(e);
  mount(document.getElementById('view'),
    h('div', { class: 'empty' }, h('div', { class: 'face' }, ':('), h('p', {}, `${t('error')}: ${e.message || e}`)));
});
