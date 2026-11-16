// Экран «Slovník»: все слова с поиском, фильтры, добавление неактивных слов в обучение.
// Импортированный словарь (например, 3104 слова из Anki) лежит здесь как «неактивные»:
// тапом «+» слово попадает в обучение, или сразу пачкой «Pridať N náhodných/ďalších».
import { h, mount } from '../dom.js';
import { t, plural, WORDS } from '../i18n.js';
import { screenTitle, toast } from '../ui.js';
import { ICONS } from '../icons.js';
import { go } from '../router.js';
import * as store from '../store.js';
import * as db from '../db.js';
import { searchKey } from '../textutil.js';
import { editNote } from './note-form.js';

const PAGE = 80;
// Фильтры и поиск запоминаются, пока приложение открыто
const state = { q: '', filter: 'all', deck: 'all', bulkN: 10 };

export async function render(el) {
  const [notes, decks, cards] = await Promise.all([store.listNotes(), store.listDecks(), db.getAll('cards')]);
  const deckName = Object.fromEntries(decks.map((d) => [d.id, d.name]));
  const suspendedNotes = new Set();
  const byNote = new Map();
  for (const c of cards) {
    if (!byNote.has(c.noteId)) byNote.set(c.noteId, []);
    byNote.get(c.noteId).push(c);
  }
  for (const [id, cs] of byNote) if (cs.length && cs.every((c) => c.suspended)) suspendedNotes.add(id);
  // Ключи поиска считаем один раз
  const keyed = notes.map((n) => ({ n, k: `${searchKey(n.sk)} ${searchKey(n.ru)} ${searchKey(n.example || '')}` }));
  keyed.sort((a, b) => a.n.sk.localeCompare(b.n.sk, 'sk'));

  let shown = PAGE;
  const list = h('div', { class: 'list' });
  const countEl = h('span', { class: 'small dim' });
  const moreBtn = h('button', { class: 'btn block ghost', onclick: () => { shown += PAGE; draw(); } }, t('dict.more'));
  const bulkBox = h('div', { class: 'bulk' });

  const filtered = () => {
    const q = searchKey(state.q);
    return keyed.filter(({ n, k }) => {
      if (state.deck !== 'all' && n.deckId !== state.deck) return false;
      if (state.filter === 'active' && (!n.active || suspendedNotes.has(n.id))) return false;
      if (state.filter === 'inactive' && n.active) return false;
      if (state.filter === 'suspended' && !suspendedNotes.has(n.id)) return false;
      return !q || k.includes(q);
    }).map((x) => x.n);
  };

  const row = (n) => {
    const status = !n.active
      ? h('button', {
        class: 'btn icon activate', 'aria-label': t('dict.activate'), html: ICONS.plus,
        onclick: async (e) => {
          e.stopPropagation();
          await store.activateNotes([n.id]);
          n.active = true;
          toast(`${t('dict.activated')} ${n.sk}`);
          e.currentTarget.replaceWith(h('span', { class: 'badge accent' }, '✓'));
        },
      })
      : suspendedNotes.has(n.id) ? h('span', { class: 'badge warn', html: ICONS.pause, style: { width: '26px', padding: '2px 5px' } }) : null;
    return h('div', {
      class: ['list-row', !n.active && 'inactive'], role: 'button', tabindex: '0',
      onclick: () => editNote(n, () => render(el)),
    },
    h('div', { class: 'main' },
      h('div', { class: 'title', lang: 'sk' }, n.sk),
      h('div', { class: 'sub', lang: 'ru' }, n.ru),
      state.deck === 'all' && h('div', { class: 'tiny faint' }, deckName[n.deckId] || '')),
    status);
  };

  const draw = () => {
    const items = filtered();
    countEl.textContent = `${items.length} ${plural(items.length, WORDS)}`;
    if (!items.length) mount(list, h('div', { class: 'empty' }, h('div', { class: 'face' }, ':('), t('dict.empty')));
    else mount(list, items.slice(0, shown).map(row));
    moreBtn.hidden = items.length <= shown;
    // Пачкой в обучение — только когда смотрим неактивные
    const inactive = items.filter((n) => !n.active);
    bulkBox.hidden = state.filter !== 'inactive' || !inactive.length;
    if (!bulkBox.hidden) drawBulk(inactive);
  };

  const drawBulk = (inactive) => {
    const nInput = h('input', {
      class: 'input', type: 'number', inputmode: 'numeric', min: 1, max: 200, value: state.bulkN,
      style: { width: '84px', flex: 'none' }, 'aria-label': 'N',
      onchange: (e) => { state.bulkN = Math.max(1, Math.min(200, Number(e.target.value) || 10)); drawBulk(inactive); },
    });
    const n = Math.min(state.bulkN, inactive.length);
    const addIds = async (ids) => {
      await store.activateNotes(ids);
      toast(t('dict.addedN', { n: ids.length }));
      render(el);
    };
    mount(bulkBox,
      h('div', { class: 'row' }, nInput,
        h('button', {
          class: 'btn grow', onclick: () => {
            const pick = inactive.slice().sort(() => Math.random() - 0.5).slice(0, n);
            addIds(pick.map((x) => x.id));
          },
        }, t('dict.addRandom', { n })),
        h('button', { class: 'btn grow', onclick: () => addIds(inactive.slice(0, n).map((x) => x.id)) }, t('dict.addNext', { n }))));
  };

  const search = h('input', {
    class: 'input', type: 'search', placeholder: t('search'), value: state.q, 'aria-label': t('search'),
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search',
    oninput: (e) => { state.q = e.target.value; shown = PAGE; draw(); },
  });

  const chip = (value, label, key) => h('button', {
    class: 'chip', 'aria-pressed': String(state[key] === value),
    onclick: (e) => {
      state[key] = value; shown = PAGE;
      e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
      draw();
    },
  }, label);

  mount(el,
    screenTitle(t('tab.dict'),
      h('button', { class: 'btn ghost small', onclick: () => go('decks') }, t('dict.decks')),
      h('button', { class: 'btn ghost small', onclick: () => go('import') }, 'Anki')),
    h('div', { class: 'search-wrap' }, h('span', { class: 'search-icon', html: ICONS.search }), search),
    h('div', { class: 'chips', style: { marginTop: '10px' } },
      chip('all', t('dict.all'), 'filter'), chip('active', t('dict.active'), 'filter'),
      chip('inactive', t('dict.inactive'), 'filter'), chip('suspended', t('dict.suspended'), 'filter')),
    h('div', { class: 'chips', style: { marginTop: '6px' } },
      chip('all', t('learn.allDecks'), 'deck'), decks.map((d) => chip(d.id, d.name, 'deck'))),
    h('div', { class: 'row', style: { margin: '8px 2px' } }, countEl),
    bulkBox,
    h('div', { class: 'panel', style: { paddingTop: '4px', paddingBottom: '4px' } }, list),
    moreBtn);
  draw();
}
