// Настройки приложения. Хранятся в meta['settings'] (синхронизируются),
// а тема/CRT дублируются в localStorage, чтобы применяться до загрузки скриптов.

import { getMeta, setMeta } from './db.js';

export const DEFAULTS = {
  lang: 'sk',               // 'sk' | 'ru' — язык интерфейса
  theme: 'dark',            // 'dark' | 'light'
  crt: true,                // сканлайны, виньетка, свечение
  newPerDay: 10,            // новых карточек в день
  reviewsPerDay: 200,       // повторений в день
  grammarNewPerDay: 5,      // новых тем грамматики в день
  streakMinCards: 10,       // день в серии: ≥ 1 сессия или ≥ N карточек
  learningSteps: [1, 10],   // шаги обучения, минуты
  relearningSteps: [10],    // шаги переобучения после «Znova», минуты
  graduatingInterval: 1,    // дней после последнего шага
  easyInterval: 4,          // дней после «Ľahké» на новой карточке
  maxInterval: 3650,        // дней
  mode: 'cards',            // последний выбранный режим: cards | typing | test | grammar
  deckId: 'all',            // последняя выбранная колода для сессии
  addDeckId: 'deck-moje-chyby', // колода по умолчанию при добавлении слова
};

let current = { ...DEFAULTS };
const listeners = new Set();

export async function loadSettings() {
  const saved = await getMeta('settings', {});
  current = { ...DEFAULTS, ...saved };
  applyUi();
  return current;
}

export const settings = () => current;

export async function saveSettings(patch) {
  current = { ...current, ...patch };
  await setMeta('settings', current);
  applyUi();
  listeners.forEach((fn) => fn(current, patch));
}

/** Вызывается после синхронизации, если настройки пришли из облака. */
export async function reloadSettings() {
  await loadSettings();
  listeners.forEach((fn) => fn(current, {}));
}

export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function applyUi() {
  const root = document.documentElement;
  root.dataset.theme = current.theme;
  root.classList.toggle('crt-off', !current.crt);
  root.lang = current.lang;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', current.theme === 'light' ? '#f3ecdf' : '#13110e');
  try {
    localStorage.setItem('slovicka.ui', JSON.stringify({ theme: current.theme, crt: current.crt }));
  } catch { /* приватный режим */ }
}
