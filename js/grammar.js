// «Časovanie a pády»: данные (data/grammar.json + правки пользователя) и источник карточек для сессии.
// Каждый глагол / существительное — одна SRS-карточка; при каждом показе случайное лицо или падеж.
import { h } from './dom.js';
import { t } from './i18n.js';
import * as db from './db.js';
import { settings } from './settings.js';
import { newCardState } from './srs.js';
import { countToday, todayFromLog } from './queue.js';
import { dayStart } from './days.js';
import { verbExercise, nounExercise, validateItem } from './grammar-core.js';

let baseCache = null;

/** Встроенные таблицы (лежат в data/grammar.json, кэшируются service worker'ом). */
async function loadBase() {
  if (!baseCache) baseCache = await (await fetch('data/grammar.json')).json();
  return baseCache;
}

/**
 * Все элементы: встроенные + правки + свои. Правка хранится в store 'grammar' под тем же id.
 * → { verbs: [...], nouns: [...] } (у каждого: builtin, custom)
 */
export async function loadGrammar() {
  const [base, overrides] = await Promise.all([loadBase(), db.getAll('grammar')]);
  const ov = new Map(overrides.map((o) => [o.id, o]));
  const merge = (list) => list.map((it) => (ov.has(it.id) ? { ...it, ...ov.get(it.id), builtin: true, edited: true } : { ...it, builtin: true }));
  const verbs = merge(base.verbs);
  const nouns = merge(base.nouns);
  for (const o of overrides) {
    if (base.verbs.some((v) => v.id === o.id) || base.nouns.some((n) => n.id === o.id)) continue;
    (o.type === 'verb' ? verbs : nouns).push({ ...o, custom: true });
  }
  return { verbs: verbs.filter(validateItem), nouns: nouns.filter(validateItem) };
}

export async function saveItem(item) {
  const { builtin, edited, custom, ...rec } = item;
  await db.put('grammar', rec);
}
export async function resetItem(id) { await db.del('grammar', id); }

/** Элементы по фильтру режима: 'verbs' | 'nouns' | 'both'. */
async function items() {
  const g = await loadGrammar();
  const f = settings().grammarFilter || 'both';
  return [...(f !== 'nouns' ? g.verbs : []), ...(f !== 'verbs' ? g.nouns : [])];
}

/** Карточки грамматики; недостающие создаются (новые). */
async function grammarCards(list) {
  const all = (await db.getAll('cards')).filter((c) => c.kind === 'grammar');
  const byId = new Map(all.map((c) => [c.id, c]));
  const missing = [];
  list.forEach((it, i) => {
    const id = `g:${it.id}`;
    if (!byId.has(id)) {
      const c = { ...newCardState(), id, noteId: id, itemId: it.id, kind: 'grammar', suspended: false, order: i, createdAt: Date.now() };
      missing.push(c);
      byId.set(id, c);
    }
  });
  if (missing.length) await db.put('cards', missing);
  return list.map((it) => byId.get(`g:${it.id}`)).filter((c) => !c.suspended);
}

const limits = () => ({ newPerDay: settings().grammarNewPerDay, reviewsPerDay: settings().reviewsPerDay });

export async function grammarCounts() {
  const list = await items();
  const cards = await grammarCards(list);
  const today = await db.getRange('reviews', 'ts', dayStart(), Number.MAX_SAFE_INTEGER);
  return countToday(cards, Date.now(), todayFromLog(today, 'grammar'), limits());
}

export async function grammarSource() {
  const list = await items();
  const byId = new Map(list.map((it) => [it.id, it]));
  const cards = await grammarCards(list);
  const today = await db.getRange('reviews', 'ts', dayStart(), Number.MAX_SAFE_INTEGER);
  return {
    kind: 'grammar',
    cards,
    today: todayFromLog(today, 'grammar'),
    limits: limits(),
    notes: [],
    describe(card) {
      const it = byId.get(card.itemId);
      if (!it) return null;
      const ex = it.inf ? verbExercise(it) : nounExercise(it);
      if (!ex) return null;
      return {
        card, note: null, item: it, ex,
        dirLabel: it.inf ? `${t('mode.grammar').split(' ')[0]} · ${t('gr.present')}` : `${t(`case.${ex.case}`)} · ${t(`gr.${ex.number}`)}`,
        front: '', back: ex.answer, accept: ex.accept, fullAnswer: ex.full,
        frontLang: 'sk', backLang: 'sk',
        prompt: (answered = false) => promptEl(it, ex, answered),
      };
    },
  };
}

/** Карточка упражнения: «robiť → oni ___» / «v ___ (Bratislava)». */
function promptEl(it, ex, answered) {
  const gap = h('span', { class: ['gap', answered && 'filled'] }, answered ? ex.answer : '  '); // пустой пропуск (два широких пробела)
  return h('div', { class: 'card-face rise grammar-face' },
    h('div', { class: 'card-dir tiny' },
      it.inf ? `${t('gr.verbs')} · ${t('gr.present')}` : `${t(`case.${ex.case}`)} · ${t(`gr.${ex.number}`)}`,
      !it.verified && h('span', { class: 'badge warn', style: { marginLeft: '8px' } }, 'neoverené')),
    h('div', { class: 'card-word word', lang: 'sk' }, ex.before, ' ', gap, ex.after ? ` ${ex.after}` : ''),
    !it.inf && h('div', { class: 'grammar-lemma word' }, `(${ex.lemma})`),
    h('div', { class: 'small dim', style: { marginTop: '10px' } }, it.ru));
}
