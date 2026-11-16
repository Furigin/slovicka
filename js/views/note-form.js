// Шторка добавления / редактирования слова.
// Добавление в 2 тапа: «+» → ввод → Enter. После сохранения поля очищаются,
// шторка остаётся открытой — можно сразу вводить следующее слово.
import { h, mount, flash } from '../dom.js';
import { t } from '../i18n.js';
import { openSheet, toast, confirmSheet, switchRow } from '../ui.js';
import { diacriticsBar } from '../diacritics.js';
import * as store from '../store.js';
import { settings, saveSettings } from '../settings.js';
import * as db from '../db.js';

/**
 * @param opts.note     слово для редактирования (если нет — добавление)
 * @param opts.deckId   колода по умолчанию
 * @param opts.onSaved  колбэк после сохранения/удаления
 */
export function openNoteForm({ note = null, deckId = null, onSaved = null, cards = [] } = {}) {
  // Функция синхронная: на iOS клавиатура открывается, только если focus() вызван
  // в том же обработчике тапа. Поэтому колоды подгружаются в select уже после открытия.
  const editing = !!note;
  let lastInput = null;
  let dupWarned = false;

  const mkInput = (name, value, ph, opts = {}) => {
    const el = h(opts.textarea ? 'textarea' : 'input', {
      class: [opts.textarea ? 'textarea' : 'input', 'word'], name, value: value || '', placeholder: ph,
      autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false',
      enterkeyhint: opts.enter || 'next', lang: opts.lang,
    });
    el.addEventListener('focus', () => { lastInput = el; });
    return el;
  };

  const sk = mkInput('sk', note?.sk, 'pätnásť', { lang: 'sk' });
  const ru = mkInput('ru', note?.ru, 'пятнадцать', { lang: 'ru' });
  const ex = mkInput('example', note?.example, 'Mám pätnásť rokov.', { lang: 'sk', enter: 'done' });
  lastInput = sk;

  const defaultDeck = deckId || note?.deckId || settings().addDeckId;
  const deckSel = h('select', { class: 'select', name: 'deck' });
  store.listDecks().then((decks) => {
    mount(deckSel, decks.map((d) => h('option', { value: d.id, selected: d.id === defaultDeck }, d.name)));
    if (!decks.some((d) => d.id === defaultDeck) && decks[0]) deckSel.value = decks[0].id;
  });

  const warn = h('p', { class: 'small', style: { color: 'var(--hard)', margin: 0 }, hidden: true });

  let active = note ? note.active !== false : true;
  let suspended = cards.length > 0 && cards.every((c) => c.suspended);

  const save = async (close) => {
    const vals = { sk: sk.value.trim(), ru: ru.value.trim(), example: ex.value.trim(), deckId: deckSel.value };
    if (!vals.sk || !vals.ru) {
      warn.textContent = t('note.required'); warn.hidden = false;
      flash(vals.sk ? ru : sk);
      (vals.sk ? ru : sk).focus();
      return;
    }
    if (!dupWarned && await store.findDuplicate(vals.sk, vals.ru, note?.id)) {
      dupWarned = true;
      warn.textContent = `${t('note.duplicate')} ${t('save')} — ${settings().lang === 'ru' ? 'нажми ещё раз' : 'stlač ešte raz'}.`;
      warn.hidden = false;
      return;
    }
    if (editing) {
      await store.updateNote({ ...note, ...vals, active });
      if (active) await store.setNoteSuspended(note.id, suspended);
      toast(t('note.saved'));
      close();
    } else {
      await store.addNote({ ...vals, active: true });
      await saveSettings({ addDeckId: vals.deckId });
      toast(`${t('note.saved')} ${vals.sk}`);
      sk.value = ''; ru.value = ''; ex.value = '';
      warn.hidden = true; dupWarned = false;
      sk.focus();
    }
    onSaved?.();
  };

  openSheet(editing ? t('note.edit') : t('note.add'), (close) => {
    // Enter: словацкое → русское → пример → сохранить. Ctrl/Cmd+Enter — сохранить из любого поля.
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.target === ex) save(close);
      else if (e.target === sk) ru.focus();
      else if (e.target === ru) ex.focus();
    };
    [sk, ru, ex].forEach((i) => i.addEventListener('keydown', onKey));
    [sk, ru].forEach((i) => i.addEventListener('input', () => { dupWarned = false; warn.hidden = true; }));

    const form = h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); save(close); } },
      h('label', { class: 'field' }, h('span', {}, t('note.sk')), sk),
      diacriticsBar(() => lastInput),
      h('label', { class: 'field' }, h('span', {}, t('note.ru')), ru),
      h('label', { class: 'field' }, h('span', {}, t('note.example')), ex),
      h('label', { class: 'field' }, h('span', {}, t('note.deck')), deckSel),
      editing && switchRow(t('note.active'), active, (v) => { active = v; }),
      editing && cards.length > 0 && switchRow(t('note.suspended'), suspended, (v) => { suspended = v; }),
      warn,
      h('div', { class: 'row' },
        editing && h('button', {
          type: 'button', class: 'btn danger',
          onclick: async () => {
            if (!(await confirmSheet(t('confirm.delete'), { okLabel: t('delete'), danger: true }))) return;
            await store.deleteNotes([note.id]);
            toast(t('note.deleted'));
            close(); onSaved?.();
          },
        }, t('delete')),
        h('button', { type: 'submit', class: 'btn primary grow' }, t('save'))),
      !editing && h('p', { class: 'tiny faint center', style: { margin: 0 } }, t('note.saveHint')));
    return form;
  });
  // Фокус сразу в первое поле (только при добавлении) — на iOS клавиатура откроется, т.к. это тот же тап
  if (!editing) sk.focus();
}

/** Редактирование: сначала подгружаем карточки слова (для переключателя «приостановлено»). */
export async function editNote(note, onSaved) {
  const cards = await db.getAllByIndex('cards', 'noteId', note.id);
  openNoteForm({ note, cards, onSaved });
}
