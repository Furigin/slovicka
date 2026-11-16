// Прогресс игрока: XP, уровень, достижения — собирается из журнала (а значит, синхронизируется).
import * as db from './db.js';
import { settings } from './settings.js';
import { activityByDay, streak } from './stats-calc.js';
import { totalXp, levelInfo, achievementStats, unlockedIds, ACHIEVEMENTS } from './gamify.js';
import { h } from './dom.js';
import { toast } from './ui.js';
import { sfx, burst } from './fx.js';

export async function loadProgress() {
  const [reviews, sessions, notes, cards] = await Promise.all([
    db.getAll('reviews'), db.getAll('sessions'), db.getAll('notes'), db.getAll('cards'),
  ]);
  const st = streak(activityByDay(reviews, sessions), settings().streakMinCards);
  const xp = totalXp(reviews);
  const stats = achievementStats({ reviews, sessions, notes, cards, streakBest: st.best });
  return { xp, level: levelInfo(xp), streak: st, stats, unlocked: unlockedIds(stats), reviews, sessions, notes, cards };
}

/** Достижения, которые открыты, но ещё не показаны на этом устройстве. */
export async function unseenAchievements(unlocked) {
  const seen = new Set(await db.getMeta('seenAchievements', []));
  return ACHIEVEMENTS.filter((a) => unlocked.includes(a.id) && !seen.has(a.id));
}

export async function markSeen(ids) {
  const seen = new Set(await db.getMeta('seenAchievements', []));
  ids.forEach((id) => seen.add(id));
  await db.setMeta('seenAchievements', [...seen]);
}

/** Значок достижения (для статистики и финального экрана). */
export function badgeEl(a, { locked = false, fresh = false } = {}) {
  const lang = settings().lang === 'ru' ? 'ru' : 'sk';
  return h('div', { class: ['ach', locked && 'locked', fresh && 'fresh'], title: lang === 'ru' ? a.dru : a.dsk },
    h('div', { class: 'ach-face' }, locked ? '??' : a.face),
    h('div', { class: 'ach-name' }, lang === 'ru' ? a.ru : a.sk),
    h('div', { class: 'ach-desc' }, lang === 'ru' ? a.dru : a.dsk));
}

/** Показать тостом новые достижения (например, после импорта) и запомнить их. */
export async function announceNew(unlocked) {
  const fresh = await unseenAchievements(unlocked);
  if (!fresh.length) return [];
  const lang = settings().lang === 'ru' ? 'ru' : 'sk';
  sfx.unlock();
  burst({ count: 40, y: 80 });
  for (const a of fresh.slice(0, 3)) {
    toast(h('span', {}, h('b', { class: 'accent' }, `[${a.face}] `), lang === 'ru' ? `Достижение: ${a.ru}` : `Odznak: ${a.sk}`), { timeout: 4000 });
  }
  await markSeen(fresh.map((a) => a.id));
  return fresh;
}
