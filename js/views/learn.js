// Главный экран «Učiť sa»: сколько карточек на сегодня, выбор колоды и режима, кнопка «Začať».
import { h, mount } from '../dom.js';
import { t, plural, DAYS, ago } from '../i18n.js';
import { settings, saveSettings } from '../settings.js';
import { screenTitle, segmented } from '../ui.js';
import { ICONS } from '../icons.js';
import { go, rerenderIf } from '../router.js';
import * as store from '../store.js';
import * as db from '../db.js';
import { countToday, todayFromLog } from '../queue.js';
import { activityByDay, streak } from '../stats-calc.js';
import { DAY } from '../days.js';

export const MODES = ['cards', 'typing', 'test', 'grammar'];

async function vocabCounts(deckId) {
  const [cards, today] = await Promise.all([store.studyCards(deckId), store.todayReviews()]);
  const s = settings();
  return countToday(cards, Date.now(), todayFromLog(today, 'vocab'), s);
}

async function counts(mode, deckId) {
  if (mode === 'grammar') return (await import('../grammar.js')).grammarCounts();
  return vocabCounts(deckId);
}

export async function render(el) {
  const s = settings();
  const [decks, reviews, sessions, notesCount, lastBackup] = await Promise.all([
    store.listDecks(), db.getAll('reviews'), db.getAll('sessions'), db.count('notes'), db.getMeta('lastBackupAt'),
  ]);
  const st = streak(activityByDay(reviews, sessions), s.streakMinCards);

  const streakBadge = h('span', { class: ['badge', st.todayDone ? 'accent' : ''], title: t('learn.streak') },
    h('span', { html: ICONS.flame, style: { display: 'inline-block', width: '13px', height: '13px', verticalAlign: '-2px', marginRight: '4px' } }),
    `${st.current} ${plural(st.current, DAYS)}`);

  // Напоминание о бэкапе раз в неделю (iOS может удалить данные сайта)
  const needBackup = notesCount >= 5 && (!lastBackup || Date.now() - lastBackup > 7 * DAY);
  const banner = needBackup && h('div', { class: 'banner' },
    h('div', { class: 'grow' }, t('backup.reminder', { when: lastBackup ? ago(lastBackup) : t('backup.never') })),
    h('button', { class: 'btn', onclick: async () => { await (await import('../backup.js')).exportBackup(); rerenderIf('learn'); } }, t('backup.now')));

  // Счётчики
  const numNew = h('div', { class: 'count-num c-new' }, '–');
  const numLearn = h('div', { class: 'count-num c-learn' }, '–');
  const numReview = h('div', { class: 'count-num c-review' }, '–');
  const startBtn = h('button', { class: 'btn primary big block', disabled: true }, t('learn.start'));
  const nothing = h('p', { class: 'dim center small', hidden: true }, t('learn.nothing'));

  let mode = MODES.includes(s.mode) ? s.mode : 'cards';
  let deckId = s.deckId === 'all' || decks.some((d) => d.id === s.deckId) ? s.deckId : 'all';

  const refresh = async () => {
    const c = await counts(mode, deckId);
    numNew.textContent = c.new;
    numLearn.textContent = c.learning;
    numReview.textContent = c.review;
    const total = c.new + c.learning + c.review;
    startBtn.disabled = total === 0;
    nothing.hidden = total > 0;
    deckField.hidden = mode === 'grammar';
    grammarField.hidden = mode !== 'grammar';
  };

  const deckSel = h('select', {
    class: 'select', 'aria-label': t('learn.deck'),
    onchange: (e) => { deckId = e.target.value; saveSettings({ deckId }); refresh(); },
  },
  h('option', { value: 'all', selected: deckId === 'all' }, t('learn.allDecks')),
  decks.map((d) => h('option', { value: d.id, selected: d.id === deckId }, d.name)));
  const deckField = h('label', { class: 'field' }, h('span', {}, t('learn.deck')), deckSel);
  // В режиме грамматики вместо колоды — что тренируем: глаголы, существительные или всё
  const grammarField = h('div', { class: 'field', hidden: true },
    h('span', {}, t('mode.grammar')),
    segmented([
      { value: 'verbs', label: t('gr.verbs') }, { value: 'nouns', label: t('gr.nouns') }, { value: 'both', label: t('gr.both') },
    ], s.grammarFilter || 'both', async (grammarFilter) => { await saveSettings({ grammarFilter }); refresh(); }));

  const modeHint = h('p', { class: 'small dim', style: { margin: '8px 2px 0' } });
  const setHint = () => { modeHint.textContent = `— ${t(`mode.${mode}.hint`)}`; };
  setHint();
  // Режимы — сетка 2×2 из кнопок (одна группа)
  const modeSwitch = h('div', { class: 'mode-grid', role: 'group', 'aria-label': t('learn.mode') });
  const modeButtons = MODES.map((m) => h('button', {
    type: 'button', class: 'mode-btn', 'aria-pressed': String(m === mode),
    onclick: () => {
      mode = m;
      modeButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(MODES[i] === m)));
      setHint();
      saveSettings({ mode });
      refresh();
    },
  }, t(`mode.${m}`)));
  mount(modeSwitch, modeButtons);

  startBtn.addEventListener('click', () => go('session', { mode, deck: deckId }));

  mount(el,
    screenTitle(t('tab.learn'), streakBadge),
    banner,
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
  );
  await refresh();

  // Обновлять счётчики, когда приложение возвращается из фона (карточки «созрели»)
  const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
  document.addEventListener('visibilitychange', onVis);
  return () => document.removeEventListener('visibilitychange', onVis);
}
