// i18n.js импортирует settings.js → db.js → idb (браузерный код). Для теста
// подменяем зависимость: читаем исходник и вытаскиваем объекты SK/RU как модуль.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../js/i18n.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, 'const settings = () => ({ lang: "sk" });');
const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
export const STRINGS = mod.STRINGS;
