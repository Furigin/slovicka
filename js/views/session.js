// Экран сессии. Общий движок для всех режимов:
//   очередь (queue.js) → режим показывает карточку → оценка → SRS (srs.js) → журнал → следующая.
// Режимы лежат в js/modes/*.js и получают ctx с общими функциями.
import { h, mount, flash } from '../dom.js';
import { t } from '../i18n.js';
import { settings } from '../settings.js';
import { ICONS } from '../icons.js';
import { go } from '../router.js';
import { openSheet, toast } from '../ui.js';
import * as store from '../store.js';
import { SessionQueue, todayFromLog } from '../queue.js';
import { schedule, preview, formatInterval, srsConfig, GRADES } from '../srs.js';
import { MIN } from '../days.js';
import { xpFor, levelTitle } from '../gamify.js';
import { loadProgress, unseenAchievements, markSeen, badgeEl } from '../progress.js';
import { play, floatText, burst, countUp, sfx, unlockAudio } from '../fx.js';

const MODE_LOADERS = {
  cards: () => import('../modes/cards.js'),
  typing: () => import('../modes/typing.js'),
  test: () => import('../modes/test.js'),
  grammar: () => import('../modes/grammar.js'),
};

/** Источник карточек для словаря (все режимы, кроме грамматики). */
async function vocabSource(deckId) {
  const [cards, notes, today] = await Promise.all([store.studyCards(deckId), store.listNotes(), store.todayReviews()]);
  const byId = new Map(notes.map((n) => [n.id, n]));
  return {
    kind: 'vocab',
    cards: cards.filter((c) => byId.has(c.noteId)),
    today: todayFromLog(today, 'vocab'),
    limits: settings(),
    notes,
    deckId,
    describe(card) {
      const note = byId.get(card.noteId);
      const ru2sk = card.dir === 'ru2sk';
      return {
        card, note,
        dirLabel: ru2sk ? 'RU → SK' : 'SK → RU',
        front: ru2sk ? note.ru : note.sk,
        back: ru2sk ? note.sk : note.ru,
        frontLang: ru2sk ? 'ru' : 'sk',
        backLang: ru2sk ? 'sk' : 'ru',
        example: note.example,
        img: note.img,
      };
    },
    refreshNote(note) { byId.set(note.id, note); },
  };
}

export async function render(el, params) {
  const mode = MODE_LOADERS[params.mode] ? params.mode : 'cards';
  const deckId = params.deck || 'all';
  const s = settings();
  const lang = s.lang;
  const cfg = srsConfig(s);

  const before = await loadProgress(); // для финального экрана: сколько было XP и какие значки
  const source = mode === 'grammar'
    ? await (await import('../grammar.js')).grammarSource()
    : await vocabSource(deckId);
  const queue = new SessionQueue(source.cards, { today: source.today, limits: source.limits });

  // ----- Разметка -----
  const progressBar = h('i', { style: { width: '0%' } });
  const cNew = h('span', { class: 'c-new' }), cLearn = h('span', { class: 'c-learn' }), cRev = h('span', { class: 'c-review' });
  const menuBtn = h('button', { class: 'btn icon ghost', 'aria-label': '…', html: ICONS.more });
  const comboBadge = h('div', { class: 'combo-badge', 'aria-live': 'polite' });
  const top = h('header', { class: 'session-top' },
    h('button', { class: 'btn icon ghost', 'aria-label': t('session.end'), html: ICONS.close, onclick: () => finish(false) }),
    h('div', { class: 'grow' },
      h('div', { class: 'progress' }, progressBar),
      h('div', { class: 'session-counts tiny' }, cNew, ' · ', cLearn, ' · ', cRev)),
    comboBadge, menuBtn);
  const stage = h('section', { class: 'stage' });
  const actions = h('footer', { class: 'session-actions' });
  mount(el, h('div', { class: ['session', `mode-${mode}`] }, top, stage, actions));
  el.classList.add('session-view');

  // ----- Состояние -----
  let current = null;       // текущий item (карточка + данные)
  let shownAt = 0;
  let done = 0, correct = 0, totalMs = 0;
  let combo = 0, maxCombo = 0, xpGained = 0, typed = 0, diaErr = 0;
  let waitTimer = null;
  let busy = false;
  const sessionStart = Date.now();
  const startTotal = queue.remaining();

  const updateTop = () => {
    const c = queue.counts();
    cNew.textContent = c.new; cLearn.textContent = c.learning; cRev.textContent = c.review;
    const total = Math.max(startTotal, done + queue.remaining());
    progressBar.style.width = `${total ? Math.round((done / total) * 100) : 100}%`;
  };

  // ----- Общие функции для режимов -----
  const ctx = {
    mode, lang, stage, actions, source,
    /** Ряд кнопок оценки с интервалами. suggested — подсвеченная (Enter выбирает её). */
    gradeRow(card, { suggested = null, meta = {} } = {}) {
      const p = preview(card, Date.now(), cfg);
      return h('div', { class: 'grade-row' }, GRADES.map((g) => h('button', {
        type: 'button', class: ['grade', `g${g}`, suggested === g && 'suggested'],
        onclick: () => ctx.grade(g, meta),
      }, h('span', { class: 'grade-name' }, t(`grade.${g}`)), h('span', { class: 'grade-ivl' }, formatInterval(p[g], lang)))));
    },
    /** Применить оценку к текущей карточке. meta: { correct, diacritic, answer } */
    async grade(g, meta = {}) {
      if (busy || !current) return;
      busy = true;
      try {
        const now = Date.now();
        const old = current.card;
        const next = { ...old, ...schedule(old, g, now, cfg) };
        const ms = now - shownAt;
        const diacritic = !!meta.diacritic;
        const xp = xpFor({ grade: g, mode, typeBefore: old.type, diacritic }, combo);
        await store.saveCard(next);
        await store.logReview({
          cardId: old.id, noteId: old.noteId || null, kind: source.kind, mode, grade: g,
          typeBefore: old.type, ms, correct: meta.correct ?? g > 1, diacritic, xp,
        });
        queue.answered(old, next, now);
        done++;
        xpGained += xp;
        if (meta.correct ?? g > 1) correct++;
        totalMs += Math.min(ms, 60_000);
        if (mode === 'typing' || mode === 'grammar') { typed++; if (diacritic) diaErr++; }
        feedback(g, xp, diacritic, meta.anchor);
        await showNext();
      } finally { busy = false; }
    },
    /** Короткий глитч на событии ошибки (если эффекты CRT включены). */
    glitch(target = stage) { flash(target, 'glitch'); },
    describe: (card) => source.describe(card),
  };

  const modeMod = await MODE_LOADERS[mode]();
  const impl = await modeMod.createMode(ctx);

  // ----- Меню карточки: изменить слово, приостановить -----
  menuBtn.addEventListener('click', () => {
    if (!current) return;
    openSheet('…', (close) => h('div', { class: 'stack' },
      current.note && h('button', {
        class: 'btn block', onclick: async () => {
          close();
          const { editNote } = await import('./note-form.js');
          editNote(current.note, async () => {
            const fresh = await store.getNote(current.note.id);
            if (!fresh) { queue.remove(current.card.id); await showNext(); return; }
            source.refreshNote?.(fresh);
            impl.show(source.describe(current.card));
          });
        },
      }, t('session.editNote')),
      h('button', {
        class: 'btn block', onclick: async () => {
          close();
          await store.setCardSuspended(current.card.id, true);
          queue.remove(current.card.id);
          toast(t('note.suspended'));
          await showNext();
        },
      }, t('session.suspend'))));
  });

  // ----- Цикл показа -----
  /** Отклик на ответ: звук, «+XP», комбо. */
  function feedback(g, xp, diacritic, anchor) {
    const ok = g > 1 && !diacritic;
    combo = ok ? combo + 1 : 0;
    maxCombo = Math.max(maxCombo, combo);
    comboBadge.textContent = combo >= 3 ? `×${combo}` : '';
    comboBadge.classList.toggle('hot', combo >= 10);
    const target = anchor || actions.querySelector(`.grade.g${g}`) || stage;
    floatText(target, `+${xp} XP`, g > 1 ? 'good' : '');
    if (g === 1) { sfx.wrong(); if (mode === 'cards') ctx.glitch(); }
    else if (g === 2) sfx.hard();
    else if (g === 4) sfx.easy();
    else sfx.good();
    if (combo >= 5 && combo % 5 === 0) {
      setTimeout(() => { floatText(comboBadge, `×${combo} kombo!`, 'combo'); sfx.combo(); }, 180);
      play(comboBadge, 'pop');
    }
  }

  async function showNext({ learnAhead = true } = {}) {
    clearTimeout(waitTimer);
    updateTop();
    const n = queue.next(Date.now(), { allowLearnAhead: learnAhead });
    if (!n) return finish(true);
    if (n.wait !== undefined) return showWait(n.wait);
    current = source.describe(n.card);
    if (!current) { queue.remove(n.card.id); return showNext(); }
    shownAt = Date.now();
    await impl.show(current);
    play(stage, 'crt-on'); // карточка «включается», как ЭЛТ-экран
  }

  function showWait(ms) {
    current = null;
    const label = h('p');
    const waitStart = Date.now();
    const tick = () => {
      const m = Math.max(1, Math.ceil((ms - (Date.now() - waitStart)) / MIN));
      label.textContent = t('session.waiting', { t: `${m} min` });
    };
    tick();
    const iv = setInterval(tick, 15_000);
    mount(stage, h('div', { class: 'empty' }, h('div', { class: 'face' }, '…'), label));
    mount(actions, h('div', { class: 'row' },
      h('button', { class: 'btn grow', onclick: () => { clearInterval(iv); finish(true); } }, t('session.end')),
      h('button', { class: 'btn primary grow', onclick: () => { clearInterval(iv); showNext({ learnAhead: true }); } }, t('session.continue'))));
    waitTimer = setTimeout(() => { clearInterval(iv); showNext(); }, ms + 500);
  }

  async function finish(completed) {
    clearTimeout(waitTimer);
    impl.destroy?.();
    if (done > 0) {
      await store.logSession({ start: sessionStart, end: Date.now(), count: done, mode, completed, maxCombo, typed, diaErr, xp: xpGained });
      import('../sync.js').then((m) => m.syncSoon()).catch(() => {});
      import('../reminders.js').then((m) => m.afterStudy()).catch(() => {});
    }
    if (!completed || done === 0) { go('learn'); return; }
    current = null;
    comboBadge.textContent = '';
    updateTop();
    progressBar.style.width = '100%';
    await showSummary();
  }

  /** Финальный экран: XP со счётчиком, полоса уровня, новые значки, частицы. */
  async function showSummary() {
    const after = await loadProgress();
    const acc = done ? Math.round((correct / done) * 100) : 0;
    const mins = Math.max(1, Math.round(totalMs / MIN));
    const lvlBefore = before.level, lvl = after.level;
    const levelUp = lvl.level > lvlBefore.level;
    const fresh = await unseenAchievements(after.unlocked);
    const ru = lang === 'ru';

    const xpNum = h('span', {}, '0');
    const bar = h('i', { style: { width: `${Math.round((levelUp ? 0 : lvlBefore.progress) * 100)}%` } });
    const stat = (v, label) => h('div', { class: 'tile' }, h('div', { class: 'tile-num' }, v), h('div', { class: 'tile-label' }, label));
    mount(stage, h('div', { class: 'summary rise' },
      h('div', { class: 'face glow summary-face' }, acc >= 90 ? '\\o/' : acc >= 70 ? ':D' : ':)'),
      h('h2', { class: 'glow accent' }, t('session.done')),
      h('div', { class: 'summary-xp glow' }, '+', xpNum, ' XP'),
      levelUp && h('div', { class: 'levelup' }, `LEVEL UP → ${lvl.level} · ${levelTitle(lvl.level, lang)}`),
      h('div', { class: 'level-line' },
        h('span', { class: 'tiny dim' }, `Lv ${lvl.level} · ${levelTitle(lvl.level, lang)}`),
        h('span', { class: 'tiny dim' }, `${lvl.into} / ${lvl.need} XP`)),
      h('div', { class: 'progress level-bar' }, bar),
      h('div', { class: 'tiles', style: { marginTop: '18px' } },
        stat(String(done), t('stats.reviewed')),
        stat(`${acc} %`, t('stats.accuracy')),
        stat(`×${maxCombo}`, ru ? 'макс. комбо' : 'max kombo'),
        stat(`${mins} min`, t('stats.time'))),
      fresh.length > 0 && h('div', { class: 'summary-ach' },
        h('div', { class: 'tiny dim', style: { margin: '18px 0 8px' } }, ru ? 'Новые достижения' : 'Nové odznaky'),
        h('div', { class: 'ach-grid' }, fresh.map((a) => badgeEl(a, { fresh: true }))))));
    mount(actions, h('button', { class: 'btn primary big block', onclick: () => go('learn') }, t('done')));

    countUp(xpNum, xpGained, { ms: 900 });
    setTimeout(() => { bar.style.width = `${Math.round(lvl.progress * 100)}%`; }, 300);
    burst();
    sfx.win();
    if (levelUp || fresh.length) setTimeout(() => { burst({ count: 50, y: innerHeight / 3 }); sfx.unlock(); }, 700);
    if (fresh.length) await markSeen(fresh.map((a) => a.id));
  }

  // ----- Клавиатура (для компьютера): 1–4 — оценки -----
  const onKey = (e) => {
    if (e.target.matches('input, textarea, select')) return;
    impl.onKey?.(e);
  };
  document.addEventListener('keydown', onKey);
  el.addEventListener('pointerdown', unlockAudio, { once: true }); // iOS: звук только после первого тапа

  if (!queue.remaining()) {
    mount(stage, h('div', { class: 'empty' }, h('div', { class: 'face' }, ':)'), h('p', {}, t('session.empty'))));
    mount(actions, h('button', { class: 'btn block', onclick: () => go('learn') }, t('back')));
  } else {
    await showNext();
  }

  return () => {
    clearTimeout(waitTimer);
    document.removeEventListener('keydown', onKey);
    impl.destroy?.();
    el.classList.remove('session-view');
  };
}
