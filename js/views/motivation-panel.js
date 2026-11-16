// Раздел настроек «Motivácia a pripomienky»: дневная цель, анимации, звуки,
// время напоминаний, push-уведомления и событие в Календаре.
import { h, mount } from '../dom.js';
import { settings, saveSettings } from '../settings.js';
import { switchRow, numberField, toast } from '../ui.js';
import * as rem from '../reminders.js'; // статично: разрешение на уведомления iOS даёт только в том же тапе
import { sfx, burst } from '../fx.js';

const TXT = {
  sk: {
    title: 'Motivácia a pripomienky',
    goal: 'Denný cieľ (kariet)', anim: 'Animácie a efekty', sound: 'Zvuky', soundHint: 'Rešpektujú tichý režim iPhonu',
    hour: 'Pripomenúť o', saver: '„Zachráň sériu“ o', off: 'vyp.',
    push: 'Upozornenia (push)', pushOn: 'Zapnúť upozornenia', pushOff: 'Vypnúť upozornenia',
    pushActive: 'Upozornenia sú zapnuté :) Prídu, len ak sa v ten deň ešte neučíš.',
    cal: 'Pridať pripomienku do Kalendára',
    calHint: 'Funguje vždy, aj bez push — iPhone pripomenie z Kalendára každý deň.',
    'not-configured': 'Push ešte nie je nastavený na serveri (README → Push). Zatiaľ použi Kalendár.',
    'not-installed': 'Na iPhone fungujú upozornenia len z ikony na ploche: Zdieľať → Pridať na plochu, potom otvor odtiaľ.',
    unsupported: 'Tento prehliadač upozornenia nepodporuje.',
    denied: 'Upozornenia sú zakázané. Povoľ ich v Nastaveniach iPhonu → Upozornenia → Slovíčka.',
    login: 'Najprv sa prihlás (Účet a synchronizácia vyššie) — server musí vedieť, kam poslať pripomienku.',
    ok: 'Hotovo! Pripomienky sú zapnuté :)',
    test: 'Vyskúšať efekty',
  },
  ru: {
    title: 'Мотивация и напоминания',
    goal: 'Дневная цель (карточек)', anim: 'Анимации и эффекты', sound: 'Звуки', soundHint: 'Уважают беззвучный режим iPhone',
    hour: 'Напомнить в', saver: '«Спаси серию» в', off: 'выкл.',
    push: 'Уведомления (push)', pushOn: 'Включить уведомления', pushOff: 'Выключить уведомления',
    pushActive: 'Уведомления включены :) Придут, только если ты в этот день ещё не учился.',
    cal: 'Добавить напоминание в Календарь',
    calHint: 'Работает всегда, даже без push — iPhone напомнит из Календаря каждый день.',
    'not-configured': 'Push ещё не настроен на сервере (README → Push). Пока используй Календарь.',
    'not-installed': 'На iPhone уведомления работают только с иконки на экране «Домой»: Поделиться → На экран «Домой», потом открой оттуда.',
    unsupported: 'Этот браузер не поддерживает уведомления.',
    denied: 'Уведомления запрещены. Разреши их: Настройки iPhone → Уведомления → Slovíčka.',
    login: 'Сначала войди в аккаунт (раздел выше) — серверу нужно знать, куда слать напоминание.',
    ok: 'Готово! Напоминания включены :)',
    test: 'Проверить эффекты',
  },
};

export function motivationPanel() {
  const s = settings();
  const T = TXT[s.lang === 'ru' ? 'ru' : 'sk'];
  const pushBox = h('div', { class: 'stack' });

  const hourSelect = (value, from, to, withOff, onChange) => h('select', {
    class: 'select', onchange: (e) => onChange(e.target.value === 'off' ? null : Number(e.target.value)),
  },
  withOff && h('option', { value: 'off', selected: value === null }, T.off),
  Array.from({ length: to - from + 1 }, (_, i) => from + i).map((hr) => h('option', { value: hr, selected: hr === value }, `${hr}:00`)));

  const savePrefs = async (patch) => { await saveSettings(patch); rem.refreshPushState(true); };

  const drawPush = async () => {
    const on = rem.pushConfigured() && await rem.pushEnabled();
    const msg = h('p', { class: 'small', style: { margin: 0 }, hidden: true });
    const show = (code) => { msg.textContent = T[code] || code; msg.hidden = false; msg.style.color = code === 'ok' ? 'var(--good)' : 'var(--hard)'; };
    if (!rem.pushConfigured()) show('not-configured');
    else if (!on && rem.isIos() && !rem.isStandalone()) show('not-installed');
    mount(pushBox,
      h('div', { class: 'small dim' }, T.push),
      on && h('p', { class: 'small', style: { margin: 0, color: 'var(--good)' } }, T.pushActive),
      rem.pushConfigured() && h('button', {
        class: ['btn block', on ? '' : 'primary'],
        onclick: async () => {
          if (on) { await rem.disablePush(); drawPush(); return; }
          const res = await rem.enablePush(); // без await до этого вызова — иначе iOS не покажет запрос
          show(res);
          if (res === 'ok') { burst({ count: 30, y: 200 }); sfx.unlock(); drawPush(); }
        },
      }, on ? T.pushOff : T.pushOn),
      msg);
  };
  drawPush();

  return h('section', { class: 'panel' },
    h('h3', {}, T.title),
    h('div', { class: 'stack' },
      numberField(T.goal, s.dailyGoal ?? 20, (v) => saveSettings({ dailyGoal: v }), { min: 1, max: 1000 }),
      switchRow(T.anim, s.anim !== false, (v) => saveSettings({ anim: v })),
      switchRow(T.sound, s.sound !== false, (v) => saveSettings({ sound: v }), T.soundHint),
      h('button', {
        class: 'btn ghost block small-btn', onclick: (e) => {
          sfx.win();
          const r = e.currentTarget.getBoundingClientRect();
          burst({ x: r.left + r.width / 2, y: r.top, count: 50 });
        },
      }, T.test),
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', {}, T.hour), hourSelect(s.reminderHour ?? 19, 6, 23, false, (v) => savePrefs({ reminderHour: v }))),
        h('label', { class: 'field' }, h('span', {}, T.saver), hourSelect(s.saverHour ?? null, 18, 23, true, (v) => savePrefs({ saverHour: v })))),
      pushBox,
      h('button', { class: 'btn block', onclick: () => rem.addToCalendar().catch((e) => toast(String(e.message || e), { error: true })) }, T.cal),
      h('p', { class: 'tiny faint', style: { margin: 0 } }, T.calHint)));
}
