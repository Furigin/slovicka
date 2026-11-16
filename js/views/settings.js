// Экран «Nastavenia»: язык, тема, CRT, лимиты, SRS, аккаунт, бэкапы, импорт, грамматика.
import { h, mount } from '../dom.js';
import { t, ago } from '../i18n.js';
import { settings, saveSettings } from '../settings.js';
import { screenTitle, segmented, switchRow, numberField, toast } from '../ui.js';
import { go, rerenderIf } from '../router.js';
import * as db from '../db.js';

function stepsField(label, value, onChange) {
  // «1 10» → [1, 10]; минуты через пробел или запятую
  return h('label', { class: 'field' }, h('span', {}, label),
    h('input', {
      class: 'input', value: value.join(' '), inputmode: 'decimal', placeholder: '1 10',
      onchange: (e) => {
        const steps = e.target.value.split(/[\s,;]+/).map(Number).filter((x) => x > 0 && x <= 1440 * 7);
        e.target.value = steps.join(' ');
        onChange(steps);
      },
    }));
}

export async function render(el) {
  const s = settings();
  const [persisted, estimate, lastBackup] = await Promise.all([
    navigator.storage?.persisted?.().catch(() => false), db.storageEstimate(), db.getMeta('lastBackupAt'),
  ]);
  const withImages = { v: false };

  const accountSlot = h('div', {}, h('p', { class: 'dim small' }, t('loading')));
  import('../sync.js').then((m) => m.renderAccountPanel(accountSlot)).catch((e) => {
    mount(accountSlot, h('p', { class: 'dim small' }, String(e.message || e)));
  });

  const backupInput = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const { importBackupFile } = await import('../backup.js');
      await importBackupFile(file);
    },
  });

  const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  const version = (await caches?.keys?.().catch(() => []) || []).find((k) => k.startsWith('slovicka-'))?.slice(9) || 'dev';

  mount(el,
    screenTitle(t('tab.settings')),

    h('section', { class: 'panel' }, h('h3', {}, t('set.account')), accountSlot),

    h('section', { class: 'panel' },
      h('h3', {}, 'Vzhľad · Вид'),
      h('div', { class: 'field' }, h('span', {}, t('set.lang')),
        segmented([{ value: 'sk', label: 'Slovenčina' }, { value: 'ru', label: 'Русский' }], s.lang,
          (lang) => saveSettings({ lang }))),
      h('div', { class: 'section-gap' }),
      h('div', { class: 'field' }, h('span', {}, t('set.theme')),
        segmented([{ value: 'dark', label: t('set.dark') }, { value: 'light', label: t('set.light') }], s.theme,
          (theme) => saveSettings({ theme }))),
      switchRow(`${t('set.crt')}: ${s.crt ? t('set.on') : t('set.off')}`, s.crt, async (crt) => {
        await saveSettings({ crt });
        rerenderIf('settings');
      })),

    h('section', { class: 'panel' },
      h('h3', {}, t('set.limits')),
      h('div', { class: 'grid2' },
        numberField(t('set.newPerDay'), s.newPerDay, (v) => saveSettings({ newPerDay: v }), { max: 500 }),
        numberField(t('set.reviewsPerDay'), s.reviewsPerDay, (v) => saveSettings({ reviewsPerDay: v }), { max: 9999 }),
        numberField(t('set.grammarNewPerDay'), s.grammarNewPerDay, (v) => saveSettings({ grammarNewPerDay: v }), { max: 100 }),
        numberField(t('set.streakMin'), s.streakMinCards, (v) => saveSettings({ streakMinCards: v }), { min: 1, max: 500 }))),

    h('section', { class: 'panel' },
      h('h3', {}, t('set.srs')),
      h('div', { class: 'grid2' },
        stepsField(t('set.steps'), s.learningSteps, (v) => saveSettings({ learningSteps: v.length ? v : [1, 10] })),
        stepsField(t('set.relearn'), s.relearningSteps, (v) => saveSettings({ relearningSteps: v.length ? v : [10] }))),
      h('p', { class: 'tiny faint', style: { marginTop: '10px' } },
        'SM-2: Znova → 1 min, Dobré → 10 min → 1 d; zrelé karty — interval ≥ 21 d')),

    h('section', { class: 'panel' },
      h('h3', {}, t('set.data')),
      h('div', { class: 'stack' },
        h('p', { class: 'small dim', style: { margin: 0 } },
          t('backup.last', { when: lastBackup ? ago(lastBackup) : t('backup.never') })),
        switchRow(t('set.withImages'), false, (v) => { withImages.v = v; }),
        h('button', {
          class: 'btn primary block', onclick: async () => {
            const { exportBackup } = await import('../backup.js');
            await exportBackup({ withImages: withImages.v });
            rerenderIf('settings');
          },
        }, t('set.export')),
        h('button', { class: 'btn block', onclick: () => backupInput.click() }, t('set.importBackup')),
        backupInput,
        h('button', { class: 'btn block', onclick: () => go('import') }, t('set.importApkg')),
        h('button', { class: 'btn block', onclick: () => go('grammar') }, t('set.grammar')))),

    h('section', { class: 'panel' },
      h('h3', {}, t('set.storage')),
      h('p', { class: 'small', style: { margin: 0 } },
        `${persisted ? t('set.persisted') : t('set.notPersisted')}`,
        estimate ? ` · ${mb(estimate.usage || 0)} / ${mb(estimate.quota || 0)}` : ''),
      !persisted && h('button', {
        class: 'btn block', style: { marginTop: '10px' },
        onclick: async () => { const ok = await db.requestPersistence(); toast(ok ? t('set.persisted') : t('set.notPersisted')); rerenderIf('settings'); },
      }, 'navigator.storage.persist()')),

    h('section', { class: 'panel' },
      h('h3', {}, t('set.about')),
      h('p', { class: 'small', style: { margin: 0 } }, `Slovíčka · verzia ${version}`),
      h('p', { class: 'tiny faint', style: { margin: '6px 0 0' } }, 'SM-2 · IndexedDB · offline · <3')));
}
