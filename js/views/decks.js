// Управление колодами: создать, переименовать, направления карточек, удалить.
import { h, mount } from '../dom.js';
import { t, plural, WORDS } from '../i18n.js';
import { screenTitle, openSheet, switchRow, confirmSheet, toast } from '../ui.js';
import { ICONS } from '../icons.js';
import { go, rerenderIf } from '../router.js';
import * as store from '../store.js';

function deckSheet(deck, counts, onDone) {
  const editing = !!deck;
  const d = deck ? structuredClone(deck) : { name: '', directions: { ru2sk: true, sk2ru: true } };
  openSheet(editing ? deck.name : t('deck.new'), (close) => {
    const name = h('input', {
      class: 'input', value: d.name, placeholder: 'Lekcia 5', autocapitalize: 'sentences', enterkeyhint: 'done',
    });
    const save = async () => {
      d.name = name.value.trim();
      if (!d.name) { name.focus(); return; }
      if (!d.directions.ru2sk && !d.directions.sk2ru) { toast(t('deck.needDir'), { error: true }); return; }
      await store.saveDeck(d);
      close(); onDone();
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    setTimeout(() => { if (!editing) name.focus(); }, 0);
    return h('div', { class: 'stack' },
      h('label', { class: 'field' }, h('span', {}, t('deck.name')), name),
      h('div', {},
        h('div', { class: 'small dim' }, t('deck.dirs')),
        switchRow(t('deck.ru2sk'), d.directions.ru2sk, (v) => { d.directions.ru2sk = v; }),
        switchRow(t('deck.sk2ru'), d.directions.sk2ru, (v) => { d.directions.sk2ru = v; })),
      h('div', { class: 'row' },
        editing && h('button', {
          class: 'btn danger', onclick: async () => {
            const n = counts[deck.id] || 0;
            if (!(await confirmSheet(t('deck.deleteConfirm', { name: deck.name, n }), { okLabel: t('delete'), danger: true }))) return;
            await store.deleteDeck(deck.id);
            close(); onDone();
          },
        }, t('delete')),
        h('button', { class: 'btn primary grow', onclick: save }, t('save'))));
  });
}

export async function render(el) {
  const [decks, notes] = await Promise.all([store.listDecks(), store.listNotes()]);
  const counts = {};
  for (const n of notes) counts[n.deckId] = (counts[n.deckId] || 0) + 1;
  const refresh = () => rerenderIf('decks');

  mount(el,
    screenTitle(t('deck.manage'),
      h('button', { class: 'btn icon ghost', 'aria-label': t('back'), html: ICONS.back, onclick: () => go('dict') })),
    h('div', { class: 'panel', style: { paddingTop: '4px', paddingBottom: '4px' } },
      h('div', { class: 'list' }, decks.map((d) => h('button', {
        class: 'list-row button-like', onclick: () => deckSheet(d, counts, refresh),
      },
      h('div', { class: 'main' },
        h('div', { class: 'title' }, d.name),
        h('div', { class: 'sub' }, `${counts[d.id] || 0} ${plural(counts[d.id] || 0, WORDS)} · ${
          [d.directions?.ru2sk !== false && 'RU→SK', d.directions?.sk2ru !== false && 'SK→RU'].filter(Boolean).join(', ')}`)),
      h('span', { class: 'faint', html: ICONS.edit, style: { width: '20px', height: '20px', display: 'inline-block' } }))))),
    h('div', { class: 'section-gap' }),
    h('button', { class: 'btn primary block', onclick: () => deckSheet(null, counts, refresh) }, `+ ${t('deck.new')}`));
}
