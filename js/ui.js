// Общие UI-элементы: тосты, шторка снизу, подтверждения, переключатели.
import { h, mount } from './dom.js';
import { ICONS } from './icons.js';
import { t } from './i18n.js';

// ---------- Тосты ----------
export function toast(text, { error = false, action = null, timeout = 2600 } = {}) {
  const root = document.getElementById('toast-root');
  const el = h('div', { class: ['toast', error && 'error'], role: 'status' },
    h('div', { class: 'grow' }, text),
    action && h('button', { class: 'btn', onclick: () => { action.run(); el.remove(); } }, action.label));
  root.append(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

// ---------- Шторка (bottom sheet) ----------
let openSheets = [];

/**
 * Открыть шторку. content — элемент или функция (close) => элемент.
 * Возвращает функцию закрытия.
 */
export function openSheet(title, content, { onClose } = {}) {
  const root = document.getElementById('overlay-root');
  const close = () => {
    backdrop.remove(); sheet.remove();
    openSheets = openSheets.filter((s) => s !== close);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape' && openSheets.at(-1) === close) close(); };
  const backdrop = h('div', { class: 'backdrop', onclick: close });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grabber' }),
    h('div', { class: 'sheet-head' },
      h('h2', {}, title),
      h('button', { class: 'btn icon ghost', 'aria-label': t('close'), onclick: close, html: ICONS.close })),
    typeof content === 'function' ? content(close) : content);
  root.append(backdrop, sheet);
  openSheets.push(close);
  document.addEventListener('keydown', onKey);
  return close;
}

export function closeAllSheets() { [...openSheets].forEach((c) => c()); }

/** Подтверждение (вместо системного confirm — он некрасивый и блокирует). */
export function confirmSheet(message, { okLabel = t('yes'), danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const close = openSheet('?', (closeFn) => h('div', { class: 'stack' },
      h('p', {}, message),
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', onclick: () => { answered = true; closeFn(); resolve(false); } }, t('cancel')),
        h('button', { class: ['btn grow', danger ? 'danger' : 'primary'], onclick: () => { answered = true; closeFn(); resolve(true); } }, okLabel))),
    { onClose: () => { if (!answered) resolve(false); } });
    return close;
  });
}

// ---------- Мелкие компоненты ----------
export function switchRow(label, checked, onChange, hint) {
  const input = h('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'switch' },
    h('span', {}, label, hint && h('span', { class: 'small dim', style: { display: 'block' } }, hint)),
    input, h('span', { class: 'track' }));
}

/** Сегментированный переключатель: options = [{value, label}] */
export function segmented(options, value, onChange, { ariaLabel } = {}) {
  const wrap = h('div', { class: 'segmented', role: 'group', 'aria-label': ariaLabel });
  const render = (v) => mount(wrap, options.map((o) => h('button', {
    type: 'button', 'aria-pressed': String(o.value === v),
    onclick: () => { render(o.value); onChange(o.value); },
  }, o.label)));
  render(value);
  return wrap;
}

export function numberField(label, value, onChange, { min = 0, max = 9999, step = 1 } = {}) {
  return h('label', { class: 'field' }, h('span', {}, label),
    h('input', {
      class: 'input', type: 'number', inputmode: 'numeric', min, max, step, value,
      onchange: (e) => {
        const v = Math.max(min, Math.min(max, Number(e.target.value) || 0));
        e.target.value = v;
        onChange(v);
      },
    }));
}

export function screenTitle(text, ...extra) {
  return h('h1', { class: 'screen-title' }, h('span', {}, text), h('span', { class: 'spacer' }), ...extra);
}
