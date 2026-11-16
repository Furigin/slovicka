// Общие части режимов: лицевая сторона карточки, ответ, пример, картинка.
import { h } from '../dom.js';
import { t } from '../i18n.js';
import { mediaUrl } from '../store.js';

/**
 * Карточка: направление, слово, (ответ + пример + картинка при reveal).
 * Возвращает { el, cleanup } — cleanup освобождает URL картинки.
 */
export async function cardFace(item, { reveal = false, hideAnswer = false } = {}) {
  const url = reveal && item.img ? await mediaUrl(item.img) : null;
  const el = h('div', { class: 'card-face rise' },
    h('div', { class: 'card-dir tiny' }, item.dirLabel),
    h('div', { class: 'card-word word', lang: item.frontLang }, multiline(item.front)),
    reveal && !hideAnswer && h('div', { class: 'card-divider' }),
    reveal && !hideAnswer && h('div', { class: 'card-answer word glow', lang: item.backLang }, multiline(item.back)),
    reveal && item.example && h('div', { class: 'card-example word', lang: 'sk' },
      h('span', { class: 'tiny faint mono' }, `${t('session.example')}: `), item.example),
    url && h('img', { class: 'card-img', src: url, alt: '' }));
  return { el, cleanup: () => { if (url) URL.revokeObjectURL(url); } };
}

/** Текст с переносами строк (из Anki приходят <br>). */
export function multiline(text) {
  const parts = String(text || '').split('\n');
  return parts.flatMap((p, i) => (i ? [h('br'), p] : [p]));
}
