// Визуальные эффекты и звуки. Всё «мягкое»: короткие анимации на событиях, без постоянного мерцания.
// Отключаются тумблером «Animácie» в настройках и системной настройкой «Уменьшение движения».
import { h } from './dom.js';
import { settings } from './settings.js';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const animOn = () => settings().anim !== false && !reduced();

/** Текст печатается по буквам, как в терминале. */
export function typewriter(el, text, { speed = 22, cursor = true } = {}) {
  if (!animOn() || !text) { el.textContent = text; return Promise.resolve(); }
  el.textContent = '';
  const chars = [...text];
  const caret = cursor ? h('span', { class: 'tw-caret' }, '▌') : null;
  return new Promise((resolve) => {
    let i = 0;
    const node = document.createTextNode('');
    el.append(node);
    if (caret) el.append(caret);
    const step = () => {
      if (!el.isConnected) return resolve();
      node.data += chars[i++];
      if (i < chars.length) setTimeout(step, chars[i - 1] === '\n' ? speed * 4 : speed);
      else { caret?.remove(); resolve(); }
    };
    step();
  });
}

/** Плавный пересчёт числа 0 → to. */
export function countUp(el, to, { ms = 650, format = (v) => String(v) } = {}) {
  if (!animOn() || !to) { el.textContent = format(to); return; }
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - (1 - p) ** 3;
    el.textContent = format(Math.round(to * eased));
    if (p < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Повторно запустить CSS-анимацию класса. */
export function play(el, cls) {
  if (!el || !animOn()) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

/** Всплывающий текст над элементом: «+10 XP», «×5». */
export function floatText(anchor, text, cls = '') {
  if (!anchor || !animOn()) return;
  const r = anchor.getBoundingClientRect();
  const el = h('div', { class: ['float-text', cls] }, text);
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top}px`;
  document.body.append(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

/**
 * «Фосфорные» частицы: янтарные точки разлетаются и гаснут (~1,5 с).
 * x, y — точка взрыва (по умолчанию центр экрана).
 */
export function burst({ x = innerWidth / 2, y = innerHeight / 2.6, count = 70, colors } = {}) {
  if (!animOn()) return;
  const cs = getComputedStyle(document.documentElement);
  const palette = colors || ['--accent', '--accent-strong', '--good', '--easy'].map((v) => cs.getPropertyValue(v).trim() || '#f2b45c');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const canvas = h('canvas', { class: 'fx-canvas' });
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: count }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const v = 2 + Math.random() * 5.5;
    return {
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.5,
      size: 1.5 + Math.random() * 2.5, life: 1, decay: 0.012 + Math.random() * 0.012,
      color: palette[i % palette.length],
    };
  });
  const frame = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.985; p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.shadowBlur = 8; ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size); // квадратные «пиксели» — в духе ЭЛТ
    }
    if (alive) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

// ---------- Звуки (синтез WebAudio, без файлов) ----------
let actx = null;
function audio() {
  if (settings().sound === false) return null;
  try {
    // 'ambient' — уважать беззвучный режим iPhone и не останавливать музыку
    if (navigator.audioSession && navigator.audioSession.type !== 'ambient') navigator.audioSession.type = 'ambient';
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch { return null; }
}

function tone(freq, { at = 0, dur = 0.12, type = 'sine', gain = 0.06, slide = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

export const sfx = {
  tap: () => tone(1400, { dur: 0.03, type: 'square', gain: 0.015 }),
  reveal: () => tone(520, { dur: 0.09, type: 'triangle', gain: 0.03, slide: 1.5 }),
  good: () => { tone(660, { dur: 0.09 }); tone(990, { at: 0.07, dur: 0.12 }); },
  easy: () => { tone(660, { dur: 0.08 }); tone(880, { at: 0.06, dur: 0.08 }); tone(1320, { at: 0.12, dur: 0.14 }); },
  hard: () => tone(520, { dur: 0.12, type: 'triangle', gain: 0.05 }),
  wrong: () => tone(196, { dur: 0.2, type: 'sawtooth', gain: 0.025, slide: 0.7 }),
  combo: () => { tone(880, { dur: 0.06, gain: 0.04 }); tone(1175, { at: 0.05, dur: 0.06, gain: 0.04 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.18, type: 'triangle', gain: 0.05 })),
  unlock: () => [784, 988, 1319].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.16, gain: 0.05 })),
};

/** Разблокировать звук на iOS (вызвать в обработчике первого тапа). */
export function unlockAudio() { audio(); }
