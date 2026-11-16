// Проверка ответа в режиме «Písanie».
//
//   compare('pätnast', 'pätnásť') →
//     { verdict: 'diacritics', grade: 2, matched: 'pätnásť', diacriticErrors: 2,
//       user: [{t:'ok', s:'pätn'}, {t:'bad', s:'a'}, …], expected: [{t:'ok', s:'pätn'}, {t:'fix', s:'á'}, …] }
//
// verdict: 'correct' (Dobré) | 'diacritics' (Ťažké — буквы верные, диакритика нет) | 'wrong' (Znova)
//
// Что игнорируется: регистр, лишние пробелы, ё/е, концевая пунктуация.
// Несколько допустимых ответов: «;» или «/». Пояснения в скобках необязательны:
// «(ты) говоришь» принимает и «говоришь». Короткие варианты через запятую
// («жить, проживать») тоже принимаются по отдельности.

import { foldLatin } from './textutil.js';

/** Нормализация с сохранением регистра (для показа пользователю). */
function tidy(s) {
  return (s || '')
    .normalize('NFC')
    .replace(/[’`´ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,!?;:…"«»„“]+|[\s.,!?;:…"«»„“]+$/g, '');
}
/** Ключ сравнения: нижний регистр + ё→е. Длина строки не меняется — индексы совпадают с tidy(). */
const key = (s) => s.toLowerCase().replace(/ё/g, 'е');

/** Все допустимые варианты ответа. */
export function alternatives(expected) {
  const out = [];
  const add = (s) => {
    const t = tidy(s);
    if (t && !out.some((o) => key(o) === key(t))) out.push(t);
  };
  for (const part of (expected || '').split(/[;/\n]/)) {
    add(part);
    add(part.replace(/[()]/g, ' '));            // «(ты) говоришь» → «ты говоришь»
    const noParens = part.replace(/\([^)]*\)/g, ' ');
    add(noParens);
    if (noParens.includes(',')) {
      const pieces = noParens.split(',').map((p) => p.trim()).filter(Boolean);
      if (pieces.every((p) => p.split(' ').length <= 3)) pieces.forEach(add);
    }
  }
  return out;
}

/** Расстояние Левенштейна + выравнивание (для подсветки ошибок). */
function align(a, b) {
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  const A = key(a), B = key(b);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  // обратный проход: операции над символами
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1)) {
      ops.push({ op: A[i - 1] === B[j - 1] ? 'eq' : 'sub', u: a[i - 1], e: b[j - 1] });
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: 'ins', u: a[i - 1] }); // лишний символ у пользователя
      i--;
    } else {
      ops.push({ op: 'del', e: b[j - 1] }); // пропущенный символ
      j--;
    }
  }
  return { dist: d[n][m], ops: ops.reverse() };
}

/** Склейка соседних символов с одинаковым статусом в сегменты. */
function segments(chars) {
  const out = [];
  for (const { t, s } of chars) {
    if (out.length && out[out.length - 1].t === t) out[out.length - 1].s += s;
    else out.push({ t, s });
  }
  return out;
}

function diffFromOps(ops) {
  const user = [], expected = [];
  for (const o of ops) {
    if (o.op === 'eq') { user.push({ t: 'ok', s: o.u }); expected.push({ t: 'ok', s: o.e }); }
    else if (o.op === 'sub') { user.push({ t: 'bad', s: o.u }); expected.push({ t: 'fix', s: o.e }); }
    else if (o.op === 'ins') user.push({ t: 'bad', s: o.u });
    else expected.push({ t: 'fix', s: o.e });
  }
  return { user: segments(user), expected: segments(expected) };
}

export function compare(input, expected) {
  const u = tidy(input);
  const alts = alternatives(expected);
  const shownExpected = tidy(expected);
  if (!u) {
    return { verdict: 'wrong', grade: 1, matched: shownExpected, diacriticErrors: 0,
      user: [], expected: [{ t: 'fix', s: shownExpected }] };
  }

  // 1. Полное совпадение
  for (const a of alts) {
    if (key(u) === key(a)) {
      return { verdict: 'correct', grade: 3, matched: a, diacriticErrors: 0,
        user: [{ t: 'ok', s: u }], expected: [{ t: 'ok', s: a }] };
    }
  }

  // 2. Совпадение без учёта диакритики → ошибка только в диакритике
  for (const a of alts) {
    if (foldLatin(key(u)) === foldLatin(key(a))) {
      const { ops } = align(u, a);
      const { user, expected: exp } = diffFromOps(ops);
      const diacriticErrors = ops.filter((o) => o.op !== 'eq').length;
      return { verdict: 'diacritics', grade: 2, matched: a, diacriticErrors, user, expected: exp };
    }
  }

  // 3. Ошибка: показываем ближайший вариант с подсветкой
  let best = null;
  for (const a of alts) {
    const r = align(u, a);
    if (!best || r.dist < best.dist) best = { ...r, a };
  }
  const { user, expected: exp } = diffFromOps(best.ops);
  return { verdict: 'wrong', grade: 1, matched: best.a, diacriticErrors: 0, user, expected: exp, distance: best.dist };
}
