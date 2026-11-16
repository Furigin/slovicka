// Простой hash-роутер: #/learn, #/dict, #/stats, #/settings, #/session, …
// Hash-маршруты работают на GitHub Pages без настройки сервера.
// Экран — это модуль js/views/*.js с функцией render(container, params) → [cleanup].

const ROUTES = {
  learn:    { tab: 'learn',    load: () => import('./views/learn.js') },
  dict:     { tab: 'dict',     load: () => import('./views/dictionary.js') },
  stats:    { tab: 'stats',    load: () => import('./views/stats.js') },
  settings: { tab: 'settings', load: () => import('./views/settings.js') },
  decks:    { tab: 'dict',     load: () => import('./views/decks.js') },
  import:   { tab: 'dict',     load: () => import('./views/import.js') },
  grammar:  { tab: 'settings', load: () => import('./views/grammar-editor.js') },
  session:  { tab: null,       load: () => import('./views/session.js'), fullscreen: true },
};

let cleanup = null;
let listeners = [];
let renderToken = 0;

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const name = ROUTES[path] ? path : 'learn';
  return { name, params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function go(name, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const hash = `#/${name}${qs ? `?${qs}` : ''}`;
  if (location.hash === hash) render();
  else location.hash = hash;
}

export function onRoute(fn) { listeners.push(fn); }

export async function render() {
  const token = ++renderToken;
  const { name, params } = parseHash();
  const route = ROUTES[name];
  const view = document.getElementById('view');
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  document.body.classList.toggle('no-tabbar', !!route.fullscreen);
  listeners.forEach((fn) => fn(name, route));
  const mod = await route.load();
  if (token !== renderToken) return; // пользователь уже ушёл на другой экран
  view.replaceChildren();
  view.scrollTop = 0;
  const res = await mod.render(view, params);
  if (token !== renderToken) { if (typeof res === 'function') res(); return; }
  cleanup = typeof res === 'function' ? res : null;
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  return render();
}

export const currentRoute = () => parseHash().name;

/** Перерисовать экран, только если пользователь всё ещё на нём (после долгих async-операций). */
export function rerenderIf(name) { if (currentRoute() === name) render(); }
export const routeTab = (name) => ROUTES[name]?.tab;
