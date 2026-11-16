// Одноразовая настройка push-уведомлений. Запускает владелец репозитория: `npm run push:setup`
//
// 1. Генерирует пару VAPID-ключей.
// 2. Публичный ключ записывает в js/push-config.js (он и должен быть публичным).
// 3. Приватный ключ кладёт в GitHub Secrets (VAPID_PRIVATE_KEY) через `gh` — на экран он не выводится
//    и в файлы не записывается.
// 4. Подсказывает, как добавить второй секрет — ключ сервисного аккаунта Firebase.
import webpush from 'web-push';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const current = readFileSync('js/push-config.js', 'utf8');
if (/vapidPublicKey = '/.test(current) && !process.argv.includes('--force')) {
  console.log('Ключи уже созданы (js/push-config.js). Пересоздать: npm run push:setup -- --force');
  process.exit(0);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const res = spawnSync('gh', ['secret', 'set', 'VAPID_PRIVATE_KEY'], { input: privateKey, stdio: ['pipe', 'inherit', 'inherit'], shell: process.platform === 'win32' });
if (res.status !== 0) {
  console.error('\nНе удалось записать секрет через gh. Проверь `gh auth status` и что ты в папке репозитория.');
  process.exit(1);
}
writeFileSync('js/push-config.js', current.replace(/export const vapidPublicKey = .*;/, `export const vapidPublicKey = '${publicKey}';`));
console.log('\n✓ VAPID: публичный ключ → js/push-config.js, приватный → секрет VAPID_PRIVATE_KEY');
console.log(`
Остался один шаг — ключ сервисного аккаунта Firebase (чтобы GitHub Actions мог читать подписки):
  1. Firebase Console → шестерёнка → Project settings → Service accounts → Generate new private key
  2. Сохранится JSON-файл. Выполни (путь — свой):
       gh secret set FIREBASE_SERVICE_ACCOUNT < путь/к/файлу.json
  3. Удали JSON-файл с диска и никому его не отправляй.
  4. npm run sw, затем git commit и git push.
`);
