// Экран «Štatistiky»: серия дней, сегодня, тепловая карта, распределение карточек,
// прогноз нагрузки и счётчик ошибок в диакритике.
import { h, mount } from '../dom.js';
import { t, plural, DAYS } from '../i18n.js';
import { settings } from '../settings.js';
import { screenTitle, segmented } from '../ui.js';
import * as db from '../db.js';
import { activityByDay, streak, distribution, forecast, todaySummary } from '../stats-calc.js';
import { dayKey, addDays } from '../days.js';
import { heatmap, bars, stackBar, hideTip } from '../charts.js';
import { loadProgress, badgeEl } from '../progress.js';
import { ACHIEVEMENTS, levelTitle } from '../gamify.js';
import { countUp } from '../fx.js';

const WEEKS = 26;

function tile(value, label) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-num' }, value), h('div', { class: 'tile-label' }, label));
}

function fmtTime(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

const shortDate = (key) => {
  const [, m, d] = key.split('-');
  return `${Number(d)}. ${Number(m)}.`;
};

export async function render(el) {
  const s = settings();
  const [reviews, sessions, cards] = await Promise.all([db.getAll('reviews'), db.getAll('sessions'), db.getAll('cards')]);
  const act = activityByDay(reviews, sessions);
  const st = streak(act, s.streakMinCards);
  const today = todaySummary(act);
  const lang = s.lang;

  const prog = await loadProgress();
  const achPanel = achievementsPanel(prog, lang);
  const lvlPanel = levelPanel(prog, lang);

  if (!reviews.length) {
    mount(el, screenTitle(t('tab.stats')),
      h('div', { class: 'panel empty' }, h('div', { class: 'face' }, ':)'), t('stats.noData')),
      lvlPanel, distributionPanel(cards), achPanel);
    return hideTip;
  }

  // ----- Тепловая карта за 26 недель -----
  const todayKey = dayKey();
  const nDays = WEEKS * 7;
  const days = Array.from({ length: nDays }, (_, i) => {
    const key = addDays(todayKey, i - nDays + 1);
    const d = act.get(key);
    const v = d?.cards || 0;
    return { key, value: v, label: `${shortDate(key)} — ${v} ${lang === 'ru' ? 'карт.' : 'kariet'}` };
  });

  // ----- Прогноз -----
  const fc = forecast(cards, 30);
  const fcBox = h('div');
  const drawForecast = (n) => {
    const vals = fc.slice(0, n);
    const labels = vals.map((_, i) => (i === 0 ? (lang === 'ru' ? 'сег.' : 'dnes') : (n === 7 || i % 5 === 0) ? `+${i}` : ''));
    mount(fcBox, bars(vals, {
      labels,
      tipText: (i) => `${i === 0 ? (lang === 'ru' ? 'Сегодня' : 'Dnes') : shortDate(addDays(todayKey, i))}: ${vals[i]}`,
    }),
    h('p', { class: 'small dim', style: { margin: '6px 0 0' } },
      `Σ ${vals.reduce((a, b) => a + b, 0)} · ⌀ ${(vals.reduce((a, b) => a + b, 0) / n).toFixed(1).replace('.', ',')}/${lang === 'ru' ? 'день' : 'deň'}`));
  };
  drawForecast(7);

  // ----- Диакритика: ошибки по дням за 30 дней -----
  const d30 = Array.from({ length: 30 }, (_, i) => addDays(todayKey, i - 29));
  const diaVals = d30.map((k) => act.get(k)?.diacritic || 0);
  const typedVals = d30.map((k) => act.get(k)?.typed || 0);
  const sum = (a, from, to) => a.slice(from, to).reduce((x, y) => x + y, 0);
  const rate = (from, to) => { const ty = sum(typedVals, from, to); return ty ? sum(diaVals, from, to) / ty : null; };
  const last7 = rate(23, 30), prev7 = rate(16, 23);
  const pct = (r) => (r === null ? '—' : `${Math.round(r * 100)} %`);
  const trend = last7 !== null && prev7 !== null
    ? (last7 < prev7 ? '↓' : last7 > prev7 ? '↑' : '→') : '';

  mount(el,
    screenTitle(t('tab.stats')),

    lvlPanel,

    h('section', { class: 'panel streak-panel' },
      h('div', { class: 'streak-num glow' }, String(st.current)),
      h('div', {},
        h('div', { class: 'streak-label' }, `${plural(st.current, DAYS)} ${lang === 'ru' ? 'подряд' : 'v rade'}`),
        h('div', { class: 'small dim' }, t('stats.best', { n: st.best }), st.todayDone ? ' · ✓ dnes' : ''))),

    h('section', { class: 'panel' },
      h('h3', {}, t('stats.today')),
      h('div', { class: 'tiles' },
        tile(String(today.reviewed), t('stats.reviewed')),
        tile(String(today.newCards), t('stats.newToday')),
        tile(today.accuracy === null ? '—' : `${Math.round(today.accuracy * 100)} %`, t('stats.accuracy')),
        tile(fmtTime(today.ms), t('stats.time')))),

    h('section', { class: 'panel' },
      h('h3', {}, t('stats.heatmap')),
      h('div', { class: 'heatmap-wrap' }, heatmap(days)),
      h('div', { class: 'hm-legend tiny dim' }, t('stats.less'),
        [0, 1, 2, 3, 4].map((l) => h('span', { class: `hm-sw hm${l}` })), t('stats.more'))),

    distributionPanel(cards),

    h('section', { class: 'panel' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '10px' } },
        h('h3', { style: { margin: 0 } }, t('stats.forecast')),
        h('div', { style: { width: '150px' } },
          segmented([{ value: 7, label: t('stats.days7') }, { value: 30, label: t('stats.days30') }], 7, drawForecast))),
      fcBox),

    h('section', { class: 'panel' },
      h('h3', {}, t('stats.diacritics')),
      h('div', { class: 'row', style: { alignItems: 'baseline', gap: '14px', marginBottom: '6px' } },
        h('div', { class: 'tile-num' }, String(sum(diaVals, 0, 30))),
        h('div', { class: 'small dim' }, `7 d: ${pct(last7)} ${trend} · ${lang === 'ru' ? 'до этого' : 'predtým'}: ${pct(prev7)}`)),
      bars(diaVals, {
        cls: 'bar-hard', height: 90,
        labels: d30.map((k, i) => (i % 7 === 2 ? shortDate(k) : '')),
        tipText: (i) => `${shortDate(d30[i])}: ${diaVals[i]} / ${typedVals[i]}`,
      }),
      h('p', { class: 'tiny faint', style: { margin: '6px 0 0' } }, t('stats.diacriticsSub'))),

    achPanel);
  countUp(el.querySelector('.streak-num'), st.current);
  return hideTip;
}

/** Уровень и опыт. */
function levelPanel(prog, lang) {
  const l = prog.level;
  const bar = h('i', { style: { width: '0%' } });
  setTimeout(() => { bar.style.width = `${Math.round(l.progress * 100)}%`; }, 80);
  const xpNum = h('span');
  countUp(xpNum, prog.xp);
  return h('section', { class: 'panel' },
    h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } },
      h('div', { class: 'hero-level' }, h('span', { class: 'accent glow' }, `Lv ${l.level}`), ` · ${levelTitle(l.level, lang)}`),
      h('div', { class: 'small dim' }, xpNum, ' XP')),
    h('div', { class: 'progress level-bar', style: { margin: '10px 0 6px' } }, bar),
    h('div', { class: 'tiny dim' }, lang === 'ru' ? `До уровня ${l.level + 1}: ${l.need - l.into} XP` : `Do levelu ${l.level + 1}: ${l.need - l.into} XP`));
}

/** Значки: открытые сверху, закрытые — полупрозрачные «??». */
function achievementsPanel(prog, lang) {
  const open = new Set(prog.unlocked);
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(open.has(b.id)) - Number(open.has(a.id)));
  return h('section', { class: 'panel' },
    h('h3', {}, `${lang === 'ru' ? 'Достижения' : 'Odznaky'} · ${open.size} / ${ACHIEVEMENTS.length}`),
    h('div', { class: 'ach-grid' }, sorted.map((a) => badgeEl(a, { locked: !open.has(a.id) }))));
}

function distributionPanel(cards) {
  const vocab = cards.filter((c) => (c.kind || 'vocab') === 'vocab');
  const d = distribution(vocab);
  const parts = [
    { key: 'new', label: t('stats.c.new'), value: d.new, cls: 'q1' },
    { key: 'learning', label: t('stats.c.learning'), value: d.learning, cls: 'q2' },
    { key: 'young', label: t('stats.c.young'), value: d.young, cls: 'q3' },
    { key: 'mature', label: t('stats.c.mature'), value: d.mature, cls: 'q4' },
  ];
  return h('section', { class: 'panel' },
    h('h3', {}, t('stats.cards')),
    stackBar(parts),
    h('div', { class: 'legend' }, parts.map((p) => h('div', { class: 'legend-item' },
      h('span', { class: `sw ${p.cls}` }),
      h('span', { class: 'small' }, p.label),
      h('span', { class: 'small dim' }, String(p.value))))),
    h('p', { class: 'tiny faint', style: { margin: '8px 0 0' } }, 'zrelé = interval ≥ 21 d'));
}
