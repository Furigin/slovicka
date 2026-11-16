// Режим «Test»: 4 варианта ответа — быстро, одной рукой, в транспорте.
// Верно → Dobré (автоматически дальше), неверно → Znova (показываем правильный).
import { h, mount, sleep } from '../dom.js';
import { t } from '../i18n.js';
import { pickDistractors, shuffled } from '../distractors.js';
import { cardFace } from './common.js';

export function createMode(ctx) {
  let item = null;
  let answered = false;
  let buttons = [];
  let cleanupFace = null;

  const pool = (field) => ctx.source.notes.map((n) => ({ text: n[field], deckId: n.deckId, noteId: n.id }));

  async function show(it) {
    item = it;
    answered = false;
    cleanupFace?.();
    const face = await cardFace(it, { reveal: false });
    cleanupFace = face.cleanup;
    mount(ctx.stage, face.el);

    const field = it.backLang; // 'sk' или 'ru'
    const wrong = pickDistractors(it.back, pool(field), { deckId: it.note.deckId, noteId: it.note.id });
    if (wrong.length < 3) {
      mount(ctx.actions, h('p', { class: 'dim center' }, t('session.testNeedMore')),
        h('button', { class: 'btn block', onclick: () => ctx.grade(3) }, t('next')));
      return;
    }
    const options = shuffled([it.back, ...wrong]);
    buttons = options.map((text, i) => h('button', {
      type: 'button', class: 'option word', lang: field,
      onclick: () => choose(i, text),
    }, h('span', { class: 'option-key tiny mono' }, String(i + 1)), h('span', {}, text)));
    mount(ctx.actions, h('div', { class: 'options' }, buttons));
  }

  async function choose(i, text) {
    if (answered) return;
    answered = true;
    const ok = text === item.back;
    buttons.forEach((b) => { b.disabled = true; });
    buttons[i].classList.add(ok ? 'is-correct' : 'is-wrong');
    if (ok) {
      await sleep(450);
      ctx.grade(3, { anchor: buttons[i] });
      return;
    }
    buttons.find((b) => b.lastChild.textContent === item.back)?.classList.add('is-correct');
    ctx.glitch(buttons[i]);
    cleanupFace?.();
    const face = await cardFace(item, { reveal: true });
    cleanupFace = face.cleanup;
    mount(ctx.stage, face.el);
    ctx.actions.append(h('button', { class: 'btn primary big block next-btn', onclick: () => ctx.grade(1) }, t('next')));
  }

  return {
    show,
    onKey(e) {
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= buttons.length) buttons[n - 1].click();
      else if (answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ctx.actions.querySelector('.next-btn')?.click(); }
    },
    destroy() { cleanupFace?.(); },
  };
}
