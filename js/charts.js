// Маленькие SVG-графики без библиотек: тепловая карта, столбики, сегментированная полоса.
// Цвета — только CSS-переменные (тема светлая/тёмная переключается сама).
// Подсказка (tooltip) — по касанию/наведению, общая для всех графиков.
import { h } from './dom.js';

const S = (tag, props = {}, ...kids) => h(tag, { ...props, svg: true }, ...kids);

// ---------- Подсказка ----------
let tipEl = null;
function tip(text, x, y) {
  if (!tipEl) {
    tipEl = h('div', { class: 'chart-tip', role: 'status' });
    document.body.append(tipEl);
  }
  if (!text) { tipEl.hidden = true; return; }
  tipEl.hidden = false;
  tipEl.textContent = text;
  const w = tipEl.offsetWidth;
  tipEl.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2))}px`;
  tipEl.style.top = `${Math.max(8, y - 44)}px`;
}
export const hideTip = () => tip(null);
document.addEventListener('scroll', hideTip, true);

/** Навесить подсказку на элемент: getText(event) → строка или null. */
function withTip(el, getText) {
  const show = (e) => {
    const text = getText(e);
    if (text) tip(text, e.clientX, e.clientY); else hideTip();
  };
  el.addEventListener('pointerdown', show);
  el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) show(e); });
  el.addEventListener('pointerleave', hideTip);
}

/**
 * Тепловая карта активности (как на GitHub): колонки — недели, строки — дни недели (пн…вс).
 * days: [{ key, value, label }] по порядку, последний — сегодня.
 */
export function heatmap(days, { cell = 10, gap = 2, levels = [1, 10, 30, 60] } = {}) {
  const first = new Date(days[0].key);
  const offset = (first.getDay() + 6) % 7; // понедельник = 0
  const cols = Math.ceil((days.length + offset) / 7);
  const W = cols * (cell + gap), H = 7 * (cell + gap);
  const level = (v) => (v <= 0 ? 0 : levels.filter((l) => v >= l).length);
  const rects = days.map((d, i) => {
    const idx = i + offset;
    const lv = level(d.value);
    return S('rect', {
      x: Math.floor(idx / 7) * (cell + gap), y: (idx % 7) * (cell + gap),
      width: cell, height: cell, rx: 2, 'data-i': i,
      class: `hm hm${lv}`,
    });
  });
  const svg = S('svg', {
    viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart heatmap',
    role: 'img', 'aria-label': `${days.filter((d) => d.value > 0).length} aktívnych dní`,
  }, rects);
  withTip(svg, (e) => {
    const i = e.target.getAttribute?.('data-i');
    return i !== null && i !== undefined ? days[Number(i)].label : null;
  });
  return svg;
}

/**
 * Столбчатый график (одна серия). values — числа; labels — подписи под осью (часть может быть '').
 * tipText(i) — текст подсказки. Значение подписывается над максимальным столбиком.
 */
export function bars(values, { labels = [], tipText = (i) => String(values[i]), height = 120, cls = 'bar-accent' } = {}) {
  const n = values.length;
  const W = 320, top = 18, bottom = 18, H = height;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...values);
  const slot = W / n;
  const bw = Math.min(24, Math.max(3, slot - 2)); // ≤ 24px, 2px воздух между столбиками
  const maxI = values.indexOf(Math.max(...values));
  const kids = [
    S('line', { x1: 0, x2: W, y1: top + plotH + 0.5, y2: top + plotH + 0.5, class: 'axis' }),
  ];
  values.forEach((v, i) => {
    const bh = v > 0 ? Math.max(2, (v / max) * plotH) : 0;
    const x = i * slot + (slot - bw) / 2;
    const y = top + plotH - bh;
    if (bh > 0) {
      // скругление 4px только сверху, у основания — прямой угол
      const r = Math.min(4, bw / 2, bh);
      kids.push(S('path', {
        class: `bar ${cls}`,
        d: `M${x},${y + bh} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + bh} Z`,
      }));
    }
    if (labels[i]) kids.push(S('text', { x: i * slot + slot / 2, y: H - 4, class: 'axis-label', 'text-anchor': 'middle' }, labels[i]));
  });
  if (values[maxI] > 0) {
    const bh = (values[maxI] / max) * plotH;
    kids.push(S('text', { x: maxI * slot + slot / 2, y: top + plotH - bh - 5, class: 'value-label', 'text-anchor': 'middle' }, String(values[maxI])));
  }
  // невидимые широкие зоны касания по всей высоте
  values.forEach((_, i) => kids.push(S('rect', { x: i * slot, y: 0, width: slot, height: H, class: 'hit', 'data-i': i })));
  const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart bars', preserveAspectRatio: 'none', role: 'img' }, kids);
  svg.setAttribute('aria-label', values.map((v, i) => tipText(i)).join('; '));
  withTip(svg, (e) => {
    const i = e.target.getAttribute?.('data-i');
    return i !== null && i !== undefined ? tipText(Number(i)) : null;
  });
  return svg;
}

/**
 * Сегментированная полоса (части целого): parts = [{ label, value, cls }].
 * Между сегментами — 2px зазор цвета фона.
 */
export function stackBar(parts, { height = 14 } = {}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const W = 320;
  const visible = parts.filter((p) => p.value > 0);
  const gaps = Math.max(0, visible.length - 1) * 2;
  let x = 0;
  const kids = visible.map((p, i) => {
    const w = (p.value / total) * (W - gaps);
    const r = S('rect', { x, y: 0, width: Math.max(1, w), height, class: `seg ${p.cls}`, 'data-i': parts.indexOf(p),
      rx: 0 });
    x += w + 2;
    return r;
  });
  const svg = S('svg', { viewBox: `0 0 ${W} ${height}`, class: 'chart stackbar', preserveAspectRatio: 'none', role: 'img',
    'aria-label': parts.map((p) => `${p.label}: ${p.value}`).join(', ') }, kids);
  withTip(svg, (e) => {
    const i = e.target.getAttribute?.('data-i');
    if (i === null || i === undefined) return null;
    const p = parts[Number(i)];
    return `${p.label}: ${p.value} (${Math.round((p.value / total) * 100)} %)`;
  });
  return h('div', { class: 'stackbar-wrap' }, svg);
}
