// Панель словацкой диакритики: á ä č ď é í ĺ ľ ň ó ô ŕ š ť ú ý ž
// Заглавные — кнопкой ⇧ или долгим нажатием на букву.
// Кнопки не забирают фокус у поля ввода, поэтому клавиатура iPhone не прячется.
//
//   const bar = diacriticsBar(() => inputElement, { docked: true });
//   docked — панель прилипает к верхнему краю экранной клавиатуры (visualViewport).

import { h } from './dom.js';
import { ICONS } from './icons.js';
import { SK_DIACRITICS } from './textutil.js';

const LONG_PRESS_MS = 420;

/** Вставить текст в позицию курсора (с поддержкой undo и события input). */
export function insertAtCursor(input, text) {
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(text, start, end, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * @param getInput  функция, возвращающая поле, в которое вставлять (последнее активное)
 * @param opts.docked  прилепить над клавиатурой
 */
export function diacriticsBar(getInput, { docked = false } = {}) {
  let shift = false;
  const letterButtons = [];

  const shiftBtn = h('button', {
    type: 'button', class: 'shift', 'aria-label': 'Shift', 'aria-pressed': 'false', html: ICONS.shift,
  });
  const setShift = (v) => {
    shift = v;
    shiftBtn.setAttribute('aria-pressed', String(v));
    letterButtons.forEach((b) => { b.textContent = v ? b.dataset.ch.toUpperCase() : b.dataset.ch; });
  };
  // pointerdown + preventDefault: фокус остаётся в поле, клавиатура не закрывается
  shiftBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); setShift(!shift); });

  for (const ch of SK_DIACRITICS) {
    const b = h('button', { type: 'button', 'data-ch': ch, 'aria-label': ch }, ch);
    let timer = null, longFired = false;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      longFired = false;
      timer = setTimeout(() => {
        longFired = true;
        insertAtCursor(getInput(), ch.toUpperCase());
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
    });
    const release = (e, cancelled) => {
      e.preventDefault();
      clearTimeout(timer);
      if (!longFired && !cancelled) {
        insertAtCursor(getInput(), shift ? ch.toUpperCase() : ch);
        if (shift) setShift(false); // ⇧ действует на одну букву, как на клавиатуре
      }
      longFired = false;
    };
    b.addEventListener('pointerup', (e) => release(e, false));
    b.addEventListener('pointercancel', (e) => release(e, true));
    b.addEventListener('pointerleave', () => clearTimeout(timer));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    letterButtons.push(b);
  }

  const bar = h('div', { class: ['diacritics-bar', docked ? 'docked' : 'inline'], role: 'toolbar', 'aria-label': 'Diakritika' },
    shiftBtn, letterButtons);

  if (docked && window.visualViewport) {
    // Над клавиатурой: смещаем панель на высоту, которую клавиатура «съела» у окна
    const vv = window.visualViewport;
    const place = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      bar.style.transform = `translateY(${-kb}px)`;
      bar.classList.toggle('kb-open', kb > 60);
    };
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
    place();
    bar.destroy = () => { vv.removeEventListener('resize', place); vv.removeEventListener('scroll', place); };
  } else {
    bar.destroy = () => {};
  }
  return bar;
}
