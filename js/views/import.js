// Экран импорта колоды Anki (.apkg): выбор файла → превью → выбор полей и колоды → импорт.
// По умолчанию слова попадают в «Slovník» как НЕАКТИВНЫЕ: учить их начнёшь,
// только когда добавишь в обучение (по одному «+» или пачкой).
import { h, mount } from '../dom.js';
import { t } from '../i18n.js';
import { screenTitle, switchRow, toast } from '../ui.js';
import { ICONS } from '../icons.js';
import { go } from '../router.js';
import * as store from '../store.js';
import * as db from '../db.js';
import { parseApkg, guessFields, buildNotes, cleanField, noteKey, mimeOf, ApkgError } from '../import-apkg.js';

// ---------- Ленивая загрузка тяжёлых библиотек (лежат локально в vendor/) ----------
const scripts = {};
function loadScript(src) {
  return (scripts[src] ||= new Promise((resolve, reject) => {
    const s = h('script', { src });
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Nepodarilo sa načítať ${src}`));
    document.head.append(s);
  }));
}
async function loadDeps() {
  await Promise.all([loadScript('vendor/jszip.min.js'), loadScript('vendor/sql-wasm.js')]);
  const [SQL, fzstd] = await Promise.all([
    window.initSqlJs({ locateFile: () => 'vendor/sql-wasm.wasm' }),
    import('../../vendor/fzstd.js'),
  ]);
  return { JSZip: window.JSZip, SQL, zstd: (u8) => fzstd.decompress(u8) };
}

const ERRORS = {
  stub: { sk: 'V balíčku je len zástupná poznámka. V Anki exportuj balíček so zapnutou voľbou „Support older Anki versions“.', ru: 'В колоде только заглушка. Экспортируй колоду в Anki с галочкой «Support older Anki versions».' },
  zstd: { sk: 'Nový formát balíčka (anki21b) sa nepodarilo rozbaliť.', ru: 'Не удалось распаковать новый формат колоды (anki21b).' },
  'not-apkg': { sk: 'Toto nie je balíček Anki (.apkg).', ru: 'Это не колода Anki (.apkg).' },
};

export async function render(el) {
  const lang = document.documentElement.lang === 'ru' ? 'ru' : 'sk';
  const body = h('div', { class: 'stack lg' });
  const fileInput = h('input', {
    type: 'file', hidden: true, // без accept: iOS не знает тип .apkg и иначе не даст выбрать файл
    onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readFile(f); },
  });

  const intro = () => mount(body,
    h('div', { class: 'panel' },
      h('p', {}, lang === 'ru'
        ? 'Выбери файл .apkg (экспорт из Anki). На iPhone — из «Файлов» или iCloud Drive. Слова по умолчанию попадут в словарь как неактивные.'
        : 'Vyber súbor .apkg (export z Anki). Na iPhone — z aplikácie Súbory alebo iCloud Drive. Slová sa predvolene uložia do slovníka ako neaktívne.'),
      h('button', { class: 'btn primary block', onclick: () => fileInput.click() },
        h('span', { html: ICONS.upload, style: { display: 'contents' } }), t('imp.choose'))),
    fileInput);

  async function readFile(file) {
    mount(body, h('div', { class: 'empty' }, h('div', { class: 'face' }, '…'), t('imp.reading'), h('div', { class: 'small faint' }, file.name)));
    try {
      const deps = await loadDeps();
      const parsed = await parseApkg(await file.arrayBuffer(), deps);
      await preview(parsed, file.name);
    } catch (e) {
      console.error(e);
      const msg = e instanceof ApkgError ? (ERRORS[e.code]?.[lang] || e.message) : `${t('error')}: ${e.message || e}`;
      mount(body, h('div', { class: 'panel' }, h('p', { style: { color: 'var(--again)' } }, msg),
        h('button', { class: 'btn block', onclick: () => fileInput.click() }, t('imp.choose'))), fileInput);
    }
  }

  async function preview(parsed, fileName) {
    const [decks, notes] = await Promise.all([store.listDecks(), store.listNotes()]);
    const existing = new Set(notes.map(noteKey));
    const guess = guessFields(parsed.notes);
    const state = {
      sk: guess.sk, ru: guess.ru,
      deckId: decks.find((d) => d.id === store.SEED_DECKS.slovnik)?.id || decks[0]?.id || '__new',
      newDeck: '', inactive: true, images: parsed.mediaNames.length > 0,
    };

    const fieldOpts = (sel) => parsed.fieldNames.map((name, i) => h('option', { value: i, selected: i === sel }, `${i + 1}: ${name}`));
    const skSel = h('select', { class: 'select', onchange: (e) => { state.sk = Number(e.target.value); redraw(); } }, fieldOpts(state.sk));
    const ruSel = h('select', { class: 'select', onchange: (e) => { state.ru = Number(e.target.value); redraw(); } }, fieldOpts(state.ru));
    const newDeckInput = h('input', {
      class: 'input', placeholder: 'Slovník 2', hidden: state.deckId !== '__new',
      oninput: (e) => { state.newDeck = e.target.value; },
    });
    const deckSel = h('select', {
      class: 'select', onchange: (e) => { state.deckId = e.target.value; newDeckInput.hidden = state.deckId !== '__new'; redraw(); },
    }, decks.map((d) => h('option', { value: d.id, selected: d.id === state.deckId }, d.name)),
    h('option', { value: '__new', selected: state.deckId === '__new' }, t('imp.newDeck')));

    const table = h('div', { class: 'list' });
    const dupInfo = h('p', { class: 'small dim', style: { margin: 0 } });
    const goBtn = h('button', { class: 'btn primary big block' }, t('imp.go'));

    const redraw = () => {
      mount(table, parsed.notes.slice(0, 10).map((n) => h('div', { class: 'list-row' },
        h('div', { class: 'main' },
          h('div', { class: 'title', lang: 'sk' }, cleanField(n.fields[state.sk]).text || '—'),
          h('div', { class: 'sub', lang: 'ru' }, cleanField(n.fields[state.ru]).text || '—')))));
      const r = buildNotes(parsed, { skField: state.sk, ruField: state.ru, deckId: 'x', existingKeys: existing });
      dupInfo.textContent = `${t('imp.notes', { n: r.notes.length })} · ${t('imp.dups', { n: r.dups })}`;
      goBtn.disabled = state.sk === state.ru || !r.notes.length;
    };

    goBtn.addEventListener('click', async () => {
      goBtn.disabled = true;
      goBtn.textContent = t('loading');
      try {
        let deckId = state.deckId;
        if (deckId === '__new') {
          const deck = await store.saveDeck({ name: state.newDeck.trim() || fileName.replace(/\.apkg$/i, ''), order: decks.length });
          deckId = deck.id;
        }
        const r = buildNotes(parsed, { skField: state.sk, ruField: state.ru, deckId, active: !state.inactive, existingKeys: existing });
        // Картинки (по галочке) — Blob в IndexedDB, только на этом устройстве
        if (state.images && r.images.length) {
          const byId = new Map(r.notes.map((n) => [n.id, n]));
          const media = [];
          for (const { noteId, name } of r.images) {
            const bytes = await parsed.readMedia(name);
            if (!bytes) continue;
            const id = `m-${noteId}`;
            media.push({ id, name, type: mimeOf(name), blob: new Blob([bytes], { type: mimeOf(name) }) });
            byId.get(noteId).img = id;
          }
          await db.put('media', media, { local: true });
        }
        await db.put('notes', r.notes);
        if (!state.inactive) await store.ensureCards(r.notes);
        toast(t('imp.done', { n: r.notes.length, d: r.dups }), { timeout: 4000 });
        go('dict');
      } catch (e) {
        console.error(e);
        toast(`${t('error')}: ${e.message || e}`, { error: true });
        goBtn.disabled = false;
        goBtn.textContent = t('imp.go');
      }
    });

    mount(body,
      h('div', { class: 'panel' },
        h('p', { style: { margin: 0 } }, h('b', {}, fileName)),
        h('p', { class: 'small dim', style: { margin: '4px 0 0' } },
          `${t('imp.notes', { n: parsed.notes.length })} · ${parsed.source}${parsed.mediaNames.length ? ` · ${parsed.mediaNames.length} img` : ''}`)),
      h('div', { class: 'panel' },
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, h('span', {}, t('imp.fieldSk')), skSel),
          h('label', { class: 'field' }, h('span', {}, t('imp.fieldRu')), ruSel)),
        h('div', { class: 'section-gap' }),
        h('h3', {}, t('imp.preview')),
        table),
      h('div', { class: 'panel stack' },
        h('label', { class: 'field' }, h('span', {}, t('imp.deck')), deckSel),
        newDeckInput,
        switchRow(t('imp.inactive'), state.inactive, (v) => { state.inactive = v; }, t('imp.inactiveHint')),
        parsed.mediaNames.length > 0 && switchRow(t('imp.images'), state.images, (v) => { state.images = v; }, t('sync.mediaNote')),
        dupInfo),
      goBtn);
    redraw();
  }

  mount(el,
    screenTitle(t('imp.title'),
      h('button', { class: 'btn icon ghost', 'aria-label': t('back'), html: ICONS.back, onclick: () => history.back() })),
    body);
  intro();
}
