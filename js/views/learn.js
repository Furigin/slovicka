// Главный экран «Učiť sa»: дневная цель, уровень, серия, сколько карточек на сегодня,
// слово дня, выбор колоды и режима, кнопка «Začať».
import { h, mount } from '../dom.js';
import { t, plural, DAYS, ago } from '../i18n.js';
import { settings, saveSettings } from '../settings.js';
import { screenTitle, segmented, toast } from '../ui.js';
import { ICONS } from '../icons.js';
import { go, rerenderIf } from '../router.js';
import * as store from '../store.js';
import * as db from '../db.js';
import { countToday, todayFromLog } from '../queue.js';
import { todaySummary, activityByDay } from '../stats-calc.js';
import { DAY, dayKey } from '../days.js';
import { levelTitle, wordOfDay } from '../gamify.js';
import { loadProgress, announceNew } from '../progress.js';
import { countUp, typewriter, animOn, burst, sfx } from '../fx.js';

export const MODES = ['cards', 'typing', 'test', 'grammar'];

async function vocabCounts(deckId) {
  const [cards, today] = await Promise.all([store.studyCards(deckId), store.todayReviews()]);
  return countToday(cards, Date.now(), todayFromLog(today, 'vocab'), settings());
}

async function counts(mode, deckId) {
  if (mode === 'grammar') return (await import('../grammar.js')).grammarCounts();
  return vocabCounts(deckId);
}

/** Кольцо дневной цели (SVG). */
function goalRing(done, goal) {
  const R = 34, C = 2 * Math.PI * R;
  const p = Math.min(1, goal ? done / goal : 0);
  const arc = h('circle', {
    svg: true, cx: 42, cy: 42, r: R, class: ['ring-arc', p >= 1 && 'ring-done'],
    'stroke-dasharray': C, 'stroke-dashoffset': C,
  });
  const num = h('div', { class: 'ring-num' }, '0');
  const el = h('div', { class: 'ring', role: 'img', 'aria-label': `${done} / ${goal}` },
    h('svg', { viewBox: '0 0 84 84', width: 84, height: 84 },
      h('circle', { svg: true, cx: 42, cy: 42, r: R, class: 'ring-bg' }), arc),
    h('div', { class: 'ring-text' }, num, h('div', { class: 'ring-goal' }, `/ ${goal}`)));
  // анимация заполнения после вставки в DOM
  requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute('stroke-dashoffset', C * (1 - p))));
  countUp(num, done);
  return el;
}

/** «Загрузка терминала» — раз в день при первом открытии. Тап — пропустить. */
async function bootOnce(lines) {
  const key = dayKey();
  if (!animOn() || (await db.getMeta('bootDay')) === key) return;
  await db.setMeta('bootDay', key);
  const pre = h('pre', { class: 'boot-text' });
  const overlay = h('div', { class: 'boot', onclick: () => overlay.remove() }, pre);
  document.body.append(overlay);
  await typewriter(pre, lines.join('\n'), { speed: 14 });
  setTimeout(() => { overlay.classList.add('boot-out'); setTimeout(() => overlay.remove(), 350); }, 650);
}

export async function render(el) {
  const s = settings();
  const ru = s.lang === 'ru';
  const [decks, prog, notesCount, lastBackup, goalDay] = await Promise.all([
    store.listDecks(), loadProgress(), db.count('notes'), db.getMeta('lastBackupAt'), db.getMeta('goalCelebrated'),
  ]);
  const st = prog.streak;
  const today = todaySummary(activityByDay(prog.reviews, prog.sessions));
  const goal = s.dailyGoal || 20;

  const streakBadge = h('span', { class: ['badge', st.todayDone ? 'accent' : ''], title: t('learn.streak') },
    h('span', { html: ICONS.flame, class: ['flame', st.todayDone && 'lit'] }),
    `${st.current} ${plural(st.current, DAYS)}`);

  // Напоминание о бэкапе раз в неделю (iOS может удалить данные сайта)
  const needBackup = notesCount >= 5 && (!lastBackup || Date.now() - lastBackup > 7 * DAY);
  const banner = needBackup && h('div', { class: 'banner' },
    h('div', { class: 'grow' }, t('backup.reminder', { when: lastBackup ? ago(lastBackup) : t('backup.never') })),
    h('button', { class: 'btn', onclick: async () => { await (await import('../backup.js')).exportBackup(); rerenderIf('learn'); } }, t('backup.now')));

  // ----- Цель, уровень, серия -----
  const lvl = prog.level;
  const xpBar = h('i', { style: { width: '0%' } });
  const hero = h('section', { class: 'panel hero' },
    goalRing(today.reviewed, goal),
    h('div', { class: 'hero-info' },
      h('div', { class: 'hero-level' }, h('span', { class: 'accent glow' }, `Lv ${lvl.level}`), ` · ${levelTitle(lvl.level, s.lang)}`),
      h('div', { class: 'progress hero-xp' }, xpBar),
      h('div', { class: 'tiny dim' }, `${lvl.into} / ${lvl.need} XP`),
      h('div', { class: 'small', style: { marginTop: '6px' } },
        today.reviewed >= goal
          ? h('span', { class: 'accent' }, ru ? 'Цель на сегодня выполнена <3' : 'Denný cieľ splnený <3')
          : h('span', { class: 'dim' }, ru ? `До цели: ${goal - today.reviewed}` : `Do cieľa: ${goal - today.reviewed}`))));
  requestAnimationFrame(() => requestAnimationFrame(() => { xpBar.style.width = `${Math.round(lvl.progress * 100)}%`; }));

  // ----- Счётчики «на сегодня» -----
  const numNew = h('div', { class: 'count-num c-new' }, '–');
  const numLearn = h('div', { class: 'count-num c-learn' }, '–');
  const numReview = h('div', { class: 'count-num c-review' }, '–');
  const startBtn = h('button', { class: 'btn primary big block start-btn', disabled: true }, t('learn.start'));
  const nothing = h('p', { class: 'dim center small', hidden: true }, t('learn.nothing'));

  let mode = MODES.includes(s.mode) ? s.mode : 'cards';
  let deckId = s.deckId === 'all' || decks.some((d) => d.id === s.deckId) ? s.deckId : 'all';
  let firstRefresh = true;

  const refresh = async () => {
    const c = await counts(mode, deckId);
    if (firstRefresh) {
      countUp(numNew, c.new); countUp(numLearn, c.learning); countUp(numReview, c.review);
      firstRefresh = false;
    } else {
      numNew.textContent = c.new; numLearn.textContent = c.learning; numReview.textContent = c.review;
    }
    const total = c.new + c.learning + c.review;
    startBtn.disabled = total === 0;
    startBtn.classList.toggle('ready', total > 0);
    nothing.hidden = total > 0;
    deckField.hidden = mode === 'grammar';
    grammarField.hidden = mode !== 'grammar';
    return c;
  };

  const deckSel = h('select', {
    class: 'select', 'aria-label': t('learn.deck'),
    onchange: (e) => { deckId = e.target.value; saveSettings({ deckId }); refresh(); },
  },
  h('option', { value: 'all', selected: deckId === 'all' }, t('learn.allDecks')),
  decks.map((d) => h('option', { value: d.id, selected: d.id === deckId }, d.name)));
  const deckField = h('label', { class: 'field' }, h('span', {}, t('learn.deck')), deckSel);
  // В режиме грамматики вместо колоды — что тренируем
  const grammarField = h('div', { class: 'field', hidden: true },
    h('span', {}, t('mode.grammar')),
    segmented([
      { value: 'verbs', label: t('gr.verbs') }, { value: 'nouns', label: t('gr.nouns') }, { value: 'both', label: t('gr.both') },
    ], s.grammarFilter || 'both', async (grammarFilter) => { await saveSettings({ grammarFilter }); refresh(); }));

  const modeHint = h('p', { class: 'small dim', style: { margin: '8px 2px 0' } });
  const setHint = () => { modeHint.textContent = `— ${t(`mode.${mode}.hint`)}`; };
  setHint();
  const modeSwitch = h('div', { class: 'mode-grid', role: 'group', 'aria-label': t('learn.mode') });
  const modeButtons = MODES.map((m) => h('button', {
    type: 'button', class: 'mode-btn', 'aria-pressed': String(m === mode),
    onclick: () => {
      mode = m;
      modeButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(MODES[i] === m)));
      setHint();
      sfx.tap();
      saveSettings({ mode });
      refresh();
    },
  }, t(`mode.${m}`)));
  mount(modeSwitch, modeButtons);

  startBtn.addEventListener('click', () => go('session', { mode, deck: deckId }));

  // ----- Слово дня -----
  const notes = prog.notes;
  const wod = wordOfDay(notes);
  const wodPanel = wod && h('section', { class: 'panel wod' },
    h('h3', {}, ru ? 'Слово дня' : 'Slovo dňa'),
    h('div', { class: 'wod-word word', lang: 'sk' }),
    h('div', { class: 'wod-ru dim', lang: 'ru' }, wod.ru),
    wod.example && h('div', { class: 'card-example word', lang: 'sk', style: { marginTop: '8px', fontSize: '15px' } }, wod.example),
    !wod.active && h('button', {
      class: 'btn small-btn', style: { marginTop: '10px' },
      onclick: async (e) => {
        await store.activateNotes([wod.id]);
        toast(`${t('dict.activated')} ${wod.sk}`);
        e.currentTarget.remove();
        refresh();
      },
    }, `+ ${t('dict.activate')}`));

  mount(el,
    screenTitle(t('tab.learn'), streakBadge),
    banner,
    hero,
    h('section', { class: 'panel today-panel' },
      h('h3', {}, t('learn.today')),
      h('div', { class: 'counts' },
        h('div', {}, numNew, h('div', { class: 'count-label' }, t('learn.new'))),
        h('div', {}, numLearn, h('div', { class: 'count-label' }, t('learn.learning'))),
        h('div', {}, numReview, h('div', { class: 'count-label' }, t('learn.review'))))),
    h('section', { class: 'panel' },
      h('h3', {}, t('learn.mode')),
      modeSwitch, modeHint,
      h('div', { class: 'section-gap' }),
      deckField, grammarField),
    h('div', { class: 'section-gap' }),
    startBtn,
    nothing,
    h('div', { class: 'section-gap' }),
    wodPanel,
  );
  if (wodPanel) typewriter(wodPanel.querySelector('.wod-word'), wod.sk, { speed: 40, cursor: false });
  const c = await refresh();

  // Дневная цель выполнена — один раз в день маленький праздник
  if (today.reviewed >= goal && goalDay !== dayKey()) {
    await db.setMeta('goalCelebrated', dayKey());
    setTimeout(() => { burst({ y: 120, count: 50 }); sfx.win(); toast(ru ? 'Цель на сегодня выполнена <3' : 'Denný cieľ splnený <3'); }, 400);
  }
  announceNew(prog.unlocked); // значки, полученные вне сессии (импорт, синхронизация)

  bootOnce([
    '> slovicka --dnes',
    `  ${ru ? 'серия' : 'séria'}: ${st.current} ${plural(st.current, DAYS)}${st.todayDone ? ' ✓' : ''}`,
    `  ${ru ? 'на сегодня' : 'na dnes'}: ${c.new + c.learning + c.review} ${ru ? 'карт.' : 'kariet'}`,
    `  Lv ${lvl.level} · ${levelTitle(lvl.level, s.lang)}`,
    `  ${ru ? 'готово' : 'pripravené'} :)`,
  ]);

  // Обновлять счётчики, когда приложение возвращается из фона (карточки «созрели»)
  const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
  document.addEventListener('visibilitychange', onVis);
  return () => document.removeEventListener('visibilitychange', onVis);
}
