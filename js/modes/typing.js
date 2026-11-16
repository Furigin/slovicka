// Режим «Písanie»: пишешь перевод сам.
//  - совпало полностью → Dobré;
//  - совпало без диакритики → Ťažké + подсветка конкретных букв;
//  - иначе → Znova. Любую оценку можно выбрать вручную («я опечатался»).
// Поле ввода не пересоздаётся между карточками — клавиатура iPhone не прячется.
// Этот же режим используется для «Časovanie a pády» (item.accept, item.prompt).
import { h, mount } from '../dom.js';
import { t } from '../i18n.js';
import { compare } from '../compare.js';
import { diacriticsBar } from '../diacritics.js';
import { cardFace } from './common.js';

export function createMode(ctx) {
  let item = null;
  let result = null;
  let cleanupFace = null;

  const input = h('input', {
    class: 'input word answer-input', type: 'text', placeholder: t('session.answerPh'),
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false',
    enterkeyhint: 'go', 'aria-label': t('session.answerPh'),
  });
  const checkBtn = h('button', { type: 'submit', class: 'btn primary' }, t('session.check'));
  const form = h('form', { class: 'answer-form', onsubmit: (e) => { e.preventDefault(); onEnter(); } }, input, checkBtn);
  const gradeSlot = h('div');
  const bar = diacriticsBar(() => input, { docked: true });
  document.body.append(bar);
  document.body.classList.add('has-diacritics');

  function onEnter() {
    if (!item) return;
    if (!result) check();
    else ctx.grade(result.grade, { diacritic: result.verdict === 'diacritics' });
  }

  async function show(it) {
    item = it;
    result = null;
    cleanupFace?.();
    const face = it.prompt ? { el: it.prompt(), cleanup: null } : await cardFace(it, { reveal: false });
    cleanupFace = face.cleanup;
    mount(ctx.stage, face.el);
    input.value = '';
    input.lang = it.backLang;
    input.readOnly = false;
    checkBtn.textContent = t('session.check');
    bar.hidden = it.backLang !== 'sk';
    document.body.classList.toggle('has-diacritics', !bar.hidden);
    mount(gradeSlot);
    mount(ctx.actions, gradeSlot, form);
    // На iOS программный фокус без тапа клавиатуру не откроет, но если она уже открыта — останется
    input.focus({ preventScroll: true });
  }

  async function check() {
    const expected = it().accept ?? it().back;
    result = compare(input.value, expected);
    const verdictText = {
      correct: t('session.correct'), diacritics: t('session.diacritics'), wrong: t('session.wrong'),
    }[result.verdict];

    cleanupFace?.();
    const face = item.prompt ? { el: item.prompt(true), cleanup: null } : await cardFace(item, { reveal: true, hideAnswer: true });
    cleanupFace = face.cleanup;
    mount(ctx.stage, face.el,
      h('div', { class: ['verdict', `v-${result.verdict}`, 'rise'] },
        h('div', { class: 'verdict-title' }, verdictText),
        result.verdict !== 'correct' && input.value.trim() && h('div', { class: 'diff-line' },
          h('span', { class: 'diff-label tiny' }, t('session.yourAnswer')),
          h('span', { class: 'word diff' }, result.user.map((s) => h('span', { class: `d-${s.t}` }, s.s)))),
        h('div', { class: 'diff-line' },
          h('span', { class: 'diff-label tiny' }, t('session.expected')),
          h('span', { class: 'word diff big' }, result.expected.map((s) => h('span', { class: `d-${s.t}` }, s.s)))),
        item.fullAnswer && result.matched !== item.fullAnswer && h('div', { class: 'small dim' }, item.fullAnswer)));
    if (result.verdict === 'wrong') ctx.glitch();

    checkBtn.textContent = '→';
    mount(gradeSlot, ctx.gradeRow(item.card, {
      suggested: result.grade, meta: { diacritic: result.verdict === 'diacritics' },
    }));
  }
  const it = () => item;

  return {
    show,
    onKey(e) {
      if (result && ['1', '2', '3', '4'].includes(e.key)) ctx.grade(Number(e.key), { diacritic: result.verdict === 'diacritics' });
    },
    destroy() {
      cleanupFace?.();
      bar.destroy();
      bar.remove();
      document.body.classList.remove('has-diacritics');
    },
  };
}
