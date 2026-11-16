// Экспорт / импорт бэкапа в JSON-файл.
// На iPhone файл отдаётся через «Поделиться» (можно сохранить в «Файлы» или iCloud Drive).
import * as db from './db.js';
import { t } from './i18n.js';
import { h } from './dom.js';
import { toast, openSheet } from './ui.js';
import { reloadSettings } from './settings.js';
import { render } from './router.js';
import { buildBackup, validateBackup, restorePlan, blobToBase64, base64ToBlob, BACKUP_STORES } from './backup-format.js';

async function readAll() {
  const out = {};
  for (const s of BACKUP_STORES) out[s] = await db.getAll(s);
  return out;
}

/** Отдать файл пользователю: Share Sheet на iOS, иначе обычное скачивание. */
async function deliverFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false; // пользователь закрыл окно «Поделиться»
      // NotAllowedError (потерян «жест») — падаем на скачивание
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  return true;
}

export async function exportBackup({ withImages = false } = {}) {
  const stores = await readAll();
  const media = [];
  if (withImages) {
    for (const m of await db.getAll('media')) {
      media.push({ id: m.id, type: m.type, name: m.name, data: await blobToBase64(m.blob) });
    }
  }
  const data = buildBackup(stores, media);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const d = new Date();
  const name = `slovicka-zaloha-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const ok = await deliverFile(blob, name);
  if (ok) {
    await db.setMeta('lastBackupAt', Date.now());
    toast(t('backup.saved'));
  }
  return ok;
}

/** Применить план восстановления к базе. */
async function applyPlan(plan, media = []) {
  let n = 0;
  for (const s of BACKUP_STORES) {
    if (plan.del[s]?.length) await db.del(s, plan.del[s]);
    if (plan.put[s]?.length) { await db.put(s, plan.put[s], { keepTime: true }); n += plan.put[s].length; }
  }
  if (media.length) {
    await db.put('media', media.map((m) => ({ id: m.id, type: m.type, name: m.name, blob: base64ToBlob(m.data, m.type) })), { local: true });
  }
  return n;
}

export async function importBackupFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  if (validateBackup(data)) { toast(t('backup.invalid'), { error: true }); return; }
  const local = await readAll();
  const date = new Date(data.exportedAt || 0).toLocaleDateString();
  const n = (data.stores.notes || []).length;

  openSheet(t('set.importBackup'), (close) => {
    const run = async (mode) => {
      close();
      const count = await applyPlan(restorePlan(local, data, mode), data.media || []);
      await reloadSettings();
      toast(t('backup.restored', { n: count }));
      import('./sync.js').then((m) => m.syncSoon()).catch(() => {});
      render();
    };
    return h('div', { class: 'stack' },
      h('p', {}, t('backup.importQ', { date, n })),
      h('button', { class: 'btn primary block', onclick: () => run('merge') }, t('backup.merge')),
      h('button', { class: 'btn danger block', onclick: () => run('replace') }, t('backup.replace')));
  });
}
