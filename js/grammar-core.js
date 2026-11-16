// Тренажёр форм: построение упражнений (чистые функции, тесты: tests/grammar.test.js).
//
// Глагол:        «robiť → oni ___»                      ответ: robia
// Существительное: «v ___ (Bratislava)» · lokál, j. č.   ответ: Bratislave (или «v Bratislave»)

export const PERSONS = ['ja', 'ty', 'on/ona', 'my', 'vy', 'oni'];
export const CASES = ['nom', 'gen', 'dat', 'acc', 'loc', 'ins'];

/**
 * Слоговые предлоги: v → vo, s → so, z → zo, k → ku (перед похожими согласными).
 * vo vlaku, vo Viedni · so ženou, so študentom · zo školy · ku kolegovi
 */
export function vocalize(prep, word) {
  const w = (word || '').toLowerCase();
  if (prep === 'v' && /^[vf]/.test(w)) return 'vo';
  if (prep === 's' && /^[szšž]/.test(w)) return 'so';
  if (prep === 'z' && /^[szšž]/.test(w)) return 'zo';
  if (prep === 'k' && /^[kg]/.test(w)) return 'ku';
  return prep;
}

/**
 * Шаблоны по падежам. text — с «{p}» на месте предлога и «___» на месте ответа.
 * cats — для каких слов подходит (person / place / thing), по умолчанию — для всех.
 */
export const TEMPLATES = {
  nom: [{ text: 'To sú ___.', plOnly: true }],
  gen: [
    { text: '{p} ___', p: 'bez' },
    { text: '{p} ___', p: 'do', cats: ['place'] },
    { text: '{p} ___', p: 'z', cats: ['place'] },
    { text: '{p} ___', p: 'od', cats: ['person'] },
  ],
  dat: [
    { text: '{p} ___', p: 'k' },
    { text: '{p} ___', p: 'vďaka', cats: ['person'] },
  ],
  acc: [
    { text: 'Vidím ___.' },
    { text: 'Čakám na ___.', cats: ['person'] },
  ],
  loc: [
    { text: 'Hovoríme o ___.' },
    { text: '{p} ___', p: 'v', cats: ['place'], where: true }, // «где?» — v / na / pri (locPrep у слова)
  ],
  ins: [
    { text: '{p} ___', p: 's', cats: ['person', 'thing'] },
    { text: '{p} ___', p: 'pred', cats: ['place'] },
  ],
};

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length];

/** Все формы глагола одной строкой: «ja robím, ty robíš, …». */
export const verbTable = (v) => v.present.map((f, i) => `${PERSONS[i]} ${f}`).join(' · ');

export function verbExercise(verb, rng = Math.random) {
  const i = Math.floor(rng() * 6) % 6;
  const form = verb.present[i];
  return {
    kind: 'verb',
    person: i,
    before: `${verb.inf} → ${PERSONS[i]}`,
    after: '',
    answer: form,
    accept: [form, `${PERSONS[i].split('/')[0]} ${form}`].join(';'),
    full: verbTable(verb),
  };
}

/**
 * Упражнение на падеж. Возвращает null, если у слова нет подходящих форм.
 * opts.number / opts.case — зафиксировать (для тестов).
 */
export function nounExercise(noun, rng = Math.random, opts = {}) {
  const options = [];
  for (const number of ['sg', 'pl']) {
    if (!noun[number]) continue;
    if (opts.number && opts.number !== number) continue;
    for (const c of CASES) {
      if (opts.case && opts.case !== c) continue;
      for (const tpl of TEMPLATES[c]) {
        if (tpl.plOnly && number !== 'pl') continue;
        if (tpl.cats && !tpl.cats.includes(noun.cat || 'thing')) continue;
        if (c === 'nom' && number === 'sg') continue;
        options.push({ number, c, tpl });
      }
    }
  }
  if (!options.length) return null;
  // единственное число чаще (A1), множественное — примерно в трети случаев
  const sg = options.filter((o) => o.number === 'sg');
  const pool = sg.length && options.length > sg.length ? (rng() < 0.66 ? sg : options.filter((o) => o.number === 'pl')) : options;
  const { number, c, tpl } = pick(pool, rng);
  const form = noun[number][CASES.indexOf(c)];

  let prep = tpl.p || '';
  if (tpl.where && noun.locPrep) prep = noun.locPrep;
  prep = prep ? vocalize(prep, form) : '';
  const text = tpl.text.replace('{p}', prep);
  const [before, after] = text.split('___');
  const lead = before.trim();
  return {
    kind: 'noun',
    number, case: c,
    before: lead,
    after: after.trim(),
    lemma: number === 'pl' ? noun.pl[0] : noun.lemma,
    answer: form,
    accept: [form, lead ? `${lead} ${form}` : null, lead ? `${lead} ${form}${after.trim()}` : null].filter(Boolean).join(';'),
    full: `${noun.lemma}: ${noun[number].join(', ')}`,
  };
}

/** Проверка формата данных (используется в тестах и в редакторе). */
export function validateItem(item) {
  if (item.inf !== undefined) {
    return Array.isArray(item.present) && item.present.length === 6 && item.present.every((f) => f && f.trim());
  }
  const ok6 = (a) => Array.isArray(a) && a.length === 6 && a.every((f) => f && f.trim());
  return !!item.lemma && ok6(item.sg) && (item.pl === null || item.pl === undefined || ok6(item.pl));
}
