// Режим «Kartičky»: показал → «Ukázať odpoveď» → оценка.
import { h, mount } from '../dom.js';
import { t } from '../i18n.js';
import { cardFace } from './common.js';

export function createMode(ctx) {
  let item = null;
  let revealed = false;
  let cleanupFace = null;

  async function show(it) {
    item = it;
    revealed = false;
    cleanupFace?.();
    const face = await cardFace(it, { reveal: false });
    cleanupFace = face.cleanup;
    mount(ctx.stage, face.el);
    mount(ctx.actions, h('button', { class: 'btn primary big block', onclick: reveal }, t('session.show')));
  }

  async function reveal() {
    if (revealed || !item) return;
    revealed = true;
    cleanupFace?.();
    const face = await cardFace(item, { reveal: true });
    cleanupFace = face.cleanup;
    mount(ctx.stage, face.el);
    mount(ctx.actions, ctx.gradeRow(item.card));
  }

  return {
    show,
    onKey(e) {
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
      else if (revealed && ['1', '2', '3', '4'].includes(e.key)) ctx.grade(Number(e.key));
      else if (revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); ctx.grade(3); }
    },
    destroy() { cleanupFace?.(); },
  };
}
