// Тренажёр форм — реализуется на этапе 6.
export async function grammarCounts() { return { new: 0, learning: 0, review: 0 }; }
export async function grammarSource() {
  return { kind: 'grammar', cards: [], today: { newDone: 0, reviewsDone: 0, seenNotes: new Set() }, limits: { newPerDay: 0, reviewsPerDay: 0 }, describe: () => null };
}
