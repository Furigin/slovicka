// Маленький помощник для создания DOM без фреймворка.
// h('button', { class: 'btn', onclick: fn }, 'Текст', h('small', {}, 'подсказка'))
// Текст всегда вставляется как текст (никакого innerHTML с пользовательскими данными).

export function h(tag, props = {}, ...children) {
  const el = tag === 'svg' || props?.svg
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false || k === 'svg') continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' && 'value' in el) el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
    else if (k === 'html') el.innerHTML = v; // только для своих статичных строк (иконки SVG)
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Заменить содержимое элемента. */
export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Небольшая задержка для микро-анимаций. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Перезапустить CSS-анимацию (например, короткий глитч при ошибке). */
export function flash(el, cls = 'glitch') {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // принудительный reflow, чтобы анимация сработала снова
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

/** Генератор id (достаточно уникальный для одного пользователя и нескольких устройств). */
export function uid(prefix = '') {
  const rnd = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36))
    .replace(/-/g, '').slice(0, 16);
  return prefix + rnd;
}
