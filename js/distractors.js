// Неправильные варианты для режима «Test».
// Правила: из той же колоды (если хватает), похожей длины, без дублей правильного ответа.
import { normalizeAnswer } from './textutil.js';

/**
 * @param correct  правильный ответ (строка)
 * @param pool     [{ text, deckId, noteId }] — кандидаты
 * @param opts     { deckId, noteId, n = 3, rng }
 * @returns массив строк (может быть короче n, если кандидатов мало)
 */
export function pickDistractors(correct, pool, { deckId = null, noteId = null, n = 3, rng = Math.random } = {}) {
  const target = normalizeAnswer(correct);
  const len = correct.length;
  const seen = new Set([target]);
  const candidates = [];
  for (const p of pool) {
    if (!p.text || p.noteId === noteId) continue;
    const key = normalizeAnswer(p.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      text: p.text,
      sameDeck: deckId && p.deckId === deckId ? 0 : 1,
      lenDiff: Math.abs(p.text.length - len) / Math.max(4, len),
      r: rng(),
    });
  }
  // Сначала та же колода, потом похожая длина; случайность внутри «похожих» (±30%)
  candidates.sort((a, b) => a.sameDeck - b.sameDeck
    || Math.floor(a.lenDiff / 0.3) - Math.floor(b.lenDiff / 0.3)
    || a.r - b.r);
  return candidates.slice(0, n).map((c) => c.text);
}

export function shuffled(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
