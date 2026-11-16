// Редактор таблиц форм: правка спряжений/склонений, отметка «проверено с преподавателем»,
// свои глаголы и существительные. Правки хранятся в IndexedDB (store 'grammar') и синхронизируются.
import { h, mount, uid } from '../dom.js';
import { t } from '../i18n.js';
import { screenTitle, segmented, openSheet, switchRow, toast, confirmSheet } from '../ui.js';
import { ICONS } from '../icons.js';
import { go, rerenderIf } from '../router.js';
import { diacriticsBar } from '../diacritics.js';
import { loadGrammar, saveItem, resetItem } from '../grammar.js';
import { PERSONS, CASES, validateItem } from '../grammar-core.js';

let tab = 'verbs';

function editSheet(item, type) {
  const isVerb = type === 'verb';
  const it = item ? structuredClone(item) : (isVerb
    ? { id: `v-custom-${uid()}`, type: 'verb', inf: '', ru: '', present: ['', '', '', '', '', ''], verified: false }
    : { id: `n-custom-${uid()}`, type: 'noun', lemma: '', ru: '', cat: 'thing', pattern: '', sg: ['', '', '', '', '', ''], pl: ['', '', '', '', '', ''], verified: false });
  let lastInput = null;
  const inp = (value, onInput, ph = '') => {
    const el = h('input', {
      class: 'input word', value, placeholder: ph, autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'sk',
      oninput: (e) => onInput(e.target.value),
    });
    el.addEventListener('focus', () => { lastInput = el; });
    return el;
  };

  openSheet(item ? (it.inf || it.lemma) : (isVerb ? t('gr.addVerb') : t('gr.addNoun')), (close) => {
    const head = isVerb
      ? h('label', { class: 'field' }, h('span', {}, t('gr.inf')), inp(it.inf, (v) => { it.inf = v; }, 'robiť'))
      : h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', {}, t('gr.lemma')), inp(it.lemma, (v) => { it.lemma = v; }, 'mesto')),
        h('label', { class: 'field' }, h('span', {}, t('gr.pattern')), inp(it.pattern || '', (v) => { it.pattern = v; }, 'mesto')));
    const ru = h('label', { class: 'field' }, h('span', {}, t('gr.translation')),
      h('input', { class: 'input', value: it.ru, oninput: (e) => { it.ru = e.target.value; } }));

    const table = isVerb
      ? h('div', { class: 'forms-table' }, PERSONS.map((p, i) => [
        h('span', { class: 'forms-label' }, p), inp(it.present[i], (v) => { it.present[i] = v; })]))
      : h('div', { class: 'forms-table three' },
        h('span'), h('span', { class: 'forms-label' }, t('gr.sg')), h('span', { class: 'forms-label' }, t('gr.pl')),
        CASES.map((c, i) => [
          h('span', { class: 'forms-label' }, t(`case.${c}`).slice(0, 3) + '.'),
          inp(it.sg[i], (v) => { it.sg[i] = v; }),
          inp(it.pl?.[i] || '', (v) => { it.pl = it.pl || ['', '', '', '', '', '']; it.pl[i] = v; })]));

    const save = async () => {
      const clean = (a) => a.map((x) => x.trim());
      if (isVerb) it.present = clean(it.present);
      else {
        it.sg = clean(it.sg);
        it.pl = it.pl && it.pl.some((x) => x.trim()) ? clean(it.pl) : null;
        if (!it.pattern) it.pattern = it.lemma;
      }
      if (!validateItem(it)) { toast(t('note.required'), { error: true }); return; }
      it.type = isVerb ? 'verb' : 'noun';
      await saveItem(it);
      toast(t('note.saved'));
      close();
      rerenderIf('grammar');
    };

    return h('div', { class: 'stack' },
      h('p', { class: 'tiny faint', style: { margin: 0 } }, t('gr.note')),
      head, ru,
      diacriticsBar(() => lastInput),
      table,
      switchRow(t('gr.markVerified'), !!it.verified, (v) => { it.verified = v; }),
      h('div', { class: 'row wrap' },
        item?.edited && h('button', {
          class: 'btn', onclick: async () => { await resetItem(it.id); close(); rerenderIf('grammar'); },
        }, t('gr.reset')),
        item?.custom && h('button', {
          class: 'btn danger', onclick: async () => {
            if (!(await confirmSheet(t('confirm.delete'), { okLabel: t('delete'), danger: true }))) return;
            await resetItem(it.id); close(); rerenderIf('grammar');
          },
        }, t('delete')),
        h('button', { class: 'btn primary grow', onclick: save }, t('save'))));
  });
}

export async function render(el) {
  const g = await loadGrammar();
  const list = h('div', { class: 'list' });
  const draw = () => {
    const items = tab === 'verbs' ? g.verbs : g.nouns;
    mount(list, items.map((it) => h('button', {
      class: 'list-row button-like', onclick: () => editSheet(it, it.inf ? 'verb' : 'noun'),
    },
    h('div', { class: 'main' },
      h('div', { class: 'title' }, it.inf || it.lemma,
        it.model && h('span', { class: 'badge', style: { marginLeft: '8px' } }, t('gr.pattern').toLowerCase())),
      h('div', { class: 'sub' }, it.inf ? it.present.join(', ') : `${it.ru} · ${t('gr.pattern').toLowerCase()} ${it.pattern}`)),
    it.verified ? h('span', { class: 'badge accent' }, t('verified')) : h('span', { class: 'badge warn' }, 'neoverené'),
    it.custom && h('span', { class: 'badge' }, t('gr.custom')))));
  };

  mount(el,
    screenTitle(t('gr.editor'),
      h('button', { class: 'btn icon ghost', 'aria-label': t('back'), html: ICONS.back, onclick: () => go('settings') })),
    h('p', { class: 'small dim' }, t('gr.note')),
    segmented([{ value: 'verbs', label: `${t('gr.verbs')} (${g.verbs.length})` }, { value: 'nouns', label: `${t('gr.nouns')} (${g.nouns.length})` }],
      tab, (v) => { tab = v; draw(); }),
    h('div', { class: 'section-gap' }),
    h('div', { class: 'panel', style: { paddingTop: '4px', paddingBottom: '4px' } }, list),
    h('div', { class: 'section-gap' }),
    h('div', { class: 'row' },
      h('button', { class: 'btn grow', onclick: () => editSheet(null, 'verb') }, t('gr.addVerb')),
      h('button', { class: 'btn grow', onclick: () => editSheet(null, 'noun') }, t('gr.addNoun'))));
  draw();
}
