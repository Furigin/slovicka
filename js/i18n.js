// Тексты интерфейса: словацкий (по умолчанию, погружение) и русский.
// t('key') — строка на текущем языке; t('key', {n: 3}) — с подстановкой {n}.
// Правило оформления: тире — «—», вместо эмодзи — текстовые смайлы :) <3

import { settings } from './settings.js';

const SK = {
  // таб-панель
  'tab.learn': 'Učiť sa', 'tab.dict': 'Slovník', 'tab.stats': 'Štatistiky', 'tab.settings': 'Nastavenia',

  // общее
  'save': 'Uložiť', 'cancel': 'Zrušiť', 'close': 'Zavrieť', 'delete': 'Odstrániť', 'edit': 'Upraviť',
  'back': 'Späť', 'next': 'Ďalej', 'done': 'Hotovo', 'yes': 'Áno', 'no': 'Nie', 'ok': 'OK',
  'add': 'Pridať', 'search': 'Hľadať…', 'loading': 'Načítavam…', 'error': 'Chyba',
  'confirm.delete': 'Naozaj odstrániť? Toto sa nedá vrátiť.',
  'unverified': 'neoverené', 'verified': 'overené',
  'update.available': 'Je dostupná nová verzia —', 'update.reload': 'obnoviť',
  'offline.ready': 'Aplikácia funguje aj offline :)',

  // главный экран
  'learn.today': 'Na dnes', 'learn.new': 'nové', 'learn.learning': 'v učení', 'learn.review': 'opakovanie',
  'learn.start': 'Začať', 'learn.deck': 'Balíček', 'learn.allDecks': 'Všetky balíčky',
  'learn.mode': 'Režim',
  'learn.nothing': 'Na dnes je hotovo :) Pridaj nové slová alebo si daj pauzu.',
  'learn.streak': 'Séria', 'learn.addWord': 'Pridať slovo',
  'learn.learnAhead': 'Opakovať vopred',
  'mode.cards': 'Kartičky', 'mode.typing': 'Písanie', 'mode.test': 'Test', 'mode.grammar': 'Časovanie a pády',
  'mode.cards.hint': 'ukáž si odpoveď a ohodnoť sa',
  'mode.typing.hint': 'napíš preklad, kontrola diakritiky',
  'mode.test.hint': '4 možnosti — rýchlo v MHD',
  'mode.grammar.hint': 'tvary slovies a pády',
  'backup.reminder': 'Posledná záloha: {when}. Urob si zálohu — iOS môže vymazať dáta.',
  'backup.never': 'zatiaľ žiadna', 'backup.last': 'Posledná záloha: {when}',
  'backup.merge': 'Zlúčiť so súčasnými dátami', 'backup.replace': 'Nahradiť všetko',
  'backup.importQ': 'Záloha z {date}: {n} slov. Ako ju obnoviť?', 'backup.invalid': 'Toto nie je záloha Slovíčok.',
  'backup.restored': 'Obnovené :) Záznamov: {n}', 'backup.saved': 'Záloha uložená :)',
  'backup.now': 'Zálohovať',

  // сессия
  'session.show': 'Ukázať odpoveď', 'session.check': 'Skontrolovať',
  'grade.1': 'Znova', 'grade.2': 'Ťažké', 'grade.3': 'Dobré', 'grade.4': 'Ľahké',
  'session.done': 'Hotovo! :)', 'session.doneSub': 'Zopakované: {n} · presnosť {acc}',
  'session.waiting': 'Ďalšia karta o {t}. Môžeš počkať alebo skončiť.',
  'session.end': 'Ukončiť', 'session.continue': 'Pokračovať',
  'session.answerPh': 'Tvoja odpoveď…',
  'session.correct': 'Správne :)', 'session.diacritics': 'Skoro! Pozor na diakritiku',
  'session.wrong': 'Nesprávne', 'session.yourAnswer': 'Ty:', 'session.expected': 'Správne:',
  'session.override': 'Iné hodnotenie:',
  'session.suspend': 'Pozastaviť kartu', 'session.editNote': 'Upraviť slovo',
  'session.empty': 'Nie sú tu žiadne karty na opakovanie.',
  'session.testNeedMore': 'Na test treba aspoň 4 rôzne slová v balíčku.',
  'session.example': 'Príklad',

  // добавление/редактирование
  'note.add': 'Pridať slovo', 'note.edit': 'Upraviť slovo',
  'note.sk': 'Slovensky', 'note.ru': 'Rusky', 'note.example': 'Príklad (nepovinné)', 'note.deck': 'Balíček',
  'note.saved': 'Uložené :)', 'note.required': 'Vyplň slovenské aj ruské pole.',
  'note.active': 'Učím sa (aktívne)', 'note.suspended': 'Pozastavené',
  'note.saveHint': 'Enter — ďalšie pole, v poslednom poli Enter uloží',
  'note.duplicate': 'Toto slovo už v slovníku máš.',
  'note.deleted': 'Slovo odstránené',

  // словарь
  'dict.all': 'Všetky', 'dict.active': 'Aktívne', 'dict.inactive': 'Neaktívne', 'dict.suspended': 'Pozastavené',
  'dict.activate': 'Pridať do učenia', 'dict.activated': 'Pridané do učenia :)',
  'dict.addRandom': '+{n} náhodne', 'dict.addNext': '+{n} po poradí',
  'dict.addedN': 'Do učenia pridaných: {n}',
  'dict.count': '{n} slov', 'dict.empty': 'Nič sa nenašlo :(',
  'dict.decks': 'Balíčky', 'dict.import': 'Import z Anki',
  'dict.more': 'Zobraziť viac',

  // колоды
  'deck.new': 'Nový balíček', 'deck.name': 'Názov', 'deck.dirs': 'Smery kariet',
  'deck.ru2sk': 'RU → SK', 'deck.sk2ru': 'SK → RU', 'deck.delete': 'Odstrániť balíček',
  'deck.deleteConfirm': 'Odstrániť balíček „{name}“ aj so všetkými slovami ({n})?',
  'deck.manage': 'Spravovať balíčky', 'deck.words': '{n} slov',
  'deck.needDir': 'Aspoň jeden smer musí zostať zapnutý.',

  // настройки
  'set.lang': 'Jazyk rozhrania', 'set.theme': 'Téma', 'set.dark': 'Tmavá', 'set.light': 'Svetlá',
  'set.crt': 'Efekty CRT', 'set.on': 'zap.', 'set.off': 'vyp.',
  'set.limits': 'Denné limity', 'set.newPerDay': 'Nové karty za deň', 'set.reviewsPerDay': 'Opakovania za deň',
  'set.grammarNewPerDay': 'Nové tvary (gramatika) za deň',
  'set.streakMin': 'Deň do série: aspoň 1 sedenie alebo N kariet',
  'set.steps': 'Kroky učenia (min.)', 'set.relearn': 'Kroky preučenia (min.)',
  'set.srs': 'Opakovanie (SM-2)',
  'set.data': 'Dáta a zálohy', 'set.export': 'Exportovať zálohu (JSON)', 'set.importBackup': 'Obnoviť zo zálohy',
  'set.withImages': 'Aj s obrázkami', 'set.importApkg': 'Importovať balíček Anki (.apkg)',
  'set.grammar': 'Tabuľky tvarov (gramatika)',
  'set.storage': 'Úložisko', 'set.persisted': 'trvalé', 'set.notPersisted': 'môže byť vymazané systémom',
  'set.about': 'O aplikácii',
  'set.account': 'Účet a synchronizácia',

  // аккаунт/синхрон
  'sync.notConfigured': 'Firebase ešte nie je nastavený (js/firebase-config.js). Aplikácia funguje lokálne.',
  'sync.email': 'E-mail', 'sync.password': 'Heslo',
  'sync.login': 'Prihlásiť sa', 'sync.register': 'Vytvoriť účet', 'sync.logout': 'Odhlásiť sa',
  'sync.reset': 'Zabudnuté heslo', 'sync.resetSent': 'E-mail na obnovenie hesla bol odoslaný.',
  'sync.now': 'Synchronizovať teraz', 'sync.last': 'Posledná synchronizácia: {when}',
  'sync.never': 'ešte nebola', 'sync.offline': 'Si offline — zosynchronizujem neskôr.',
  'sync.ok': 'Zosynchronizované :)', 'sync.loggedAs': 'Účet: {email}',
  'sync.pending': 'Čaká na odoslanie: {n}',
  'sync.mediaNote': 'Obrázky zostávajú len v tomto zariadení (a v zálohe JSON).',

  // статистика
  'stats.today': 'Dnes', 'stats.reviewed': 'zopakované', 'stats.newToday': 'nové', 'stats.accuracy': 'presnosť',
  'stats.time': 'čas', 'stats.streak': 'Séria dní', 'stats.best': 'najdlhšia: {n}',
  'stats.heatmap': 'Aktivita', 'stats.cards': 'Karty', 'stats.c.new': 'nové', 'stats.c.learning': 'v učení',
  'stats.c.young': 'mladé', 'stats.c.mature': 'zrelé', 'stats.forecast': 'Predpoveď opakovaní',
  'stats.diacritics': 'Chyby v diakritike', 'stats.diacriticsSub': 'za posledných 30 dní (podiel z odpovedí v Písaní)',
  'stats.less': 'menej', 'stats.more': 'viac', 'stats.days7': '7 dní', 'stats.days30': '30 dní',
  'stats.noData': 'Zatiaľ žiadne dáta — začni sa učiť :)',

  // импорт
  'imp.title': 'Import z Anki', 'imp.choose': 'Vybrať súbor .apkg', 'imp.reading': 'Čítam balíček…',
  'imp.notes': 'Poznámok: {n}', 'imp.preview': 'Ukážka (prvých 10)',
  'imp.fieldSk': 'Pole so slovenčinou', 'imp.fieldRu': 'Pole s ruštinou', 'imp.field': 'Pole {n}',
  'imp.deck': 'Do balíčka', 'imp.newDeck': '+ nový balíček…', 'imp.inactive': 'Len do slovníka (neaktívne)',
  'imp.inactiveHint': 'Slová sa nebudú učiť, kým ich v Slovníku nepridáš do učenia.',
  'imp.images': 'Importovať obrázky', 'imp.go': 'Importovať', 'imp.done': 'Importované: {n}, preskočené duplikáty: {d}',
  'imp.dups': 'Duplikáty (preskočia sa): {n}',

  // грамматика
  'gr.verbs': 'Slovesá', 'gr.nouns': 'Podstatné mená', 'gr.both': 'Všetko',
  'gr.present': 'prítomný čas', 'gr.sg': 'j. č.', 'gr.pl': 'mn. č.',
  'gr.editor': 'Tabuľky tvarov', 'gr.addVerb': '+ sloveso', 'gr.addNoun': '+ podstatné meno',
  'gr.inf': 'Neurčitok', 'gr.lemma': 'Základný tvar', 'gr.translation': 'Preklad (RU)', 'gr.pattern': 'Vzor',
  'gr.markVerified': 'Overené s učiteľom', 'gr.reset': 'Vrátiť pôvodné', 'gr.custom': 'vlastné',
  'gr.note': 'Vygenerované tvary sú označené ako „neoverené“ — skontroluj ich s učiteľom.',
  'case.nom': 'nominatív', 'case.gen': 'genitív', 'case.dat': 'datív', 'case.acc': 'akuzatív',
  'case.loc': 'lokál', 'case.ins': 'inštrumentál',
};

const RU = {
  'tab.learn': 'Учить', 'tab.dict': 'Словарь', 'tab.stats': 'Статистика', 'tab.settings': 'Настройки',

  'save': 'Сохранить', 'cancel': 'Отмена', 'close': 'Закрыть', 'delete': 'Удалить', 'edit': 'Изменить',
  'back': 'Назад', 'next': 'Дальше', 'done': 'Готово', 'yes': 'Да', 'no': 'Нет', 'ok': 'OK',
  'add': 'Добавить', 'search': 'Поиск…', 'loading': 'Загрузка…', 'error': 'Ошибка',
  'confirm.delete': 'Точно удалить? Это нельзя отменить.',
  'unverified': 'не проверено', 'verified': 'проверено',
  'update.available': 'Доступна новая версия —', 'update.reload': 'обновить',
  'offline.ready': 'Приложение работает и офлайн :)',

  'learn.today': 'На сегодня', 'learn.new': 'новые', 'learn.learning': 'в изучении', 'learn.review': 'повторение',
  'learn.start': 'Začať', 'learn.deck': 'Колода', 'learn.allDecks': 'Все колоды',
  'learn.mode': 'Режим',
  'learn.nothing': 'На сегодня всё :) Добавь новые слова или отдохни.',
  'learn.streak': 'Серия', 'learn.addWord': 'Добавить слово',
  'learn.learnAhead': 'Повторить заранее',
  'mode.cards': 'Kartičky', 'mode.typing': 'Písanie', 'mode.test': 'Test', 'mode.grammar': 'Časovanie a pády',
  'mode.cards.hint': 'карточки: показать ответ и оценить себя',
  'mode.typing.hint': 'пишешь перевод, проверка диакритики',
  'mode.test.hint': '4 варианта — быстро в транспорте',
  'mode.grammar.hint': 'спряжение глаголов и падежи',
  'backup.reminder': 'Последний бэкап: {when}. Сделай бэкап — iOS может стереть данные.',
  'backup.never': 'ещё не было', 'backup.last': 'Последний бэкап: {when}',
  'backup.merge': 'Объединить с текущими данными', 'backup.replace': 'Заменить всё',
  'backup.importQ': 'Бэкап от {date}: слов {n}. Как восстановить?', 'backup.invalid': 'Это не бэкап Slovíčka.',
  'backup.restored': 'Восстановлено :) Записей: {n}', 'backup.saved': 'Бэкап сохранён :)',
  'backup.now': 'Сделать бэкап',

  'session.show': 'Ukázať odpoveď', 'session.check': 'Проверить',
  'grade.1': 'Znova', 'grade.2': 'Ťažké', 'grade.3': 'Dobré', 'grade.4': 'Ľahké',
  'session.done': 'Hotovo! :)', 'session.doneSub': 'Повторено: {n} · точность {acc}',
  'session.waiting': 'Следующая карточка через {t}. Можно подождать или закончить.',
  'session.end': 'Закончить', 'session.continue': 'Продолжить',
  'session.answerPh': 'Твой ответ…',
  'session.correct': 'Верно :)', 'session.diacritics': 'Почти! Ошибка в диакритике',
  'session.wrong': 'Неверно', 'session.yourAnswer': 'Ты:', 'session.expected': 'Верно:',
  'session.override': 'Другая оценка:',
  'session.suspend': 'Приостановить карточку', 'session.editNote': 'Изменить слово',
  'session.empty': 'Здесь нет карточек для повторения.',
  'session.testNeedMore': 'Для теста нужно хотя бы 4 разных слова в колоде.',
  'session.example': 'Пример',

  'note.add': 'Добавить слово', 'note.edit': 'Изменить слово',
  'note.sk': 'Словацкий', 'note.ru': 'Русский', 'note.example': 'Пример (необязательно)', 'note.deck': 'Колода',
  'note.saved': 'Сохранено :)', 'note.required': 'Заполни словацкое и русское поле.',
  'note.active': 'Учу (активно)', 'note.suspended': 'Приостановлено',
  'note.saveHint': 'Enter — следующее поле, в последнем Enter сохраняет',
  'note.duplicate': 'Это слово уже есть в словаре.',
  'note.deleted': 'Слово удалено',

  'dict.all': 'Все', 'dict.active': 'Активные', 'dict.inactive': 'Неактивные', 'dict.suspended': 'Приостановлены',
  'dict.activate': 'Добавить в обучение', 'dict.activated': 'Добавлено в обучение :)',
  'dict.addRandom': '+{n} случайно', 'dict.addNext': '+{n} по порядку',
  'dict.addedN': 'Добавлено в обучение: {n}',
  'dict.count': 'слов: {n}', 'dict.empty': 'Ничего не найдено :(',
  'dict.decks': 'Колоды', 'dict.import': 'Импорт из Anki',
  'dict.more': 'Показать ещё',

  'deck.new': 'Новая колода', 'deck.name': 'Название', 'deck.dirs': 'Направления карточек',
  'deck.ru2sk': 'RU → SK', 'deck.sk2ru': 'SK → RU', 'deck.delete': 'Удалить колоду',
  'deck.deleteConfirm': 'Удалить колоду «{name}» вместе со всеми словами ({n})?',
  'deck.manage': 'Управление колодами', 'deck.words': 'слов: {n}',
  'deck.needDir': 'Хотя бы одно направление должно остаться включённым.',

  'set.lang': 'Язык интерфейса', 'set.theme': 'Тема', 'set.dark': 'Тёмная', 'set.light': 'Светлая',
  'set.crt': 'Эффекты CRT', 'set.on': 'вкл.', 'set.off': 'выкл.',
  'set.limits': 'Дневные лимиты', 'set.newPerDay': 'Новых карточек в день', 'set.reviewsPerDay': 'Повторений в день',
  'set.grammarNewPerDay': 'Новых форм (грамматика) в день',
  'set.streakMin': 'День в серии: ≥ 1 сессия или ≥ N карточек',
  'set.steps': 'Шаги обучения (мин.)', 'set.relearn': 'Шаги переобучения (мин.)',
  'set.srs': 'Повторение (SM-2)',
  'set.data': 'Данные и бэкапы', 'set.export': 'Экспорт бэкапа (JSON)', 'set.importBackup': 'Восстановить из бэкапа',
  'set.withImages': 'С картинками', 'set.importApkg': 'Импорт колоды Anki (.apkg)',
  'set.grammar': 'Таблицы форм (грамматика)',
  'set.storage': 'Хранилище', 'set.persisted': 'постоянное', 'set.notPersisted': 'система может очистить',
  'set.about': 'О приложении',
  'set.account': 'Аккаунт и синхронизация',

  'sync.notConfigured': 'Firebase ещё не настроен (js/firebase-config.js). Приложение работает локально.',
  'sync.email': 'E-mail', 'sync.password': 'Пароль',
  'sync.login': 'Войти', 'sync.register': 'Создать аккаунт', 'sync.logout': 'Выйти',
  'sync.reset': 'Забыл пароль', 'sync.resetSent': 'Письмо для сброса пароля отправлено.',
  'sync.now': 'Синхронизировать', 'sync.last': 'Последняя синхронизация: {when}',
  'sync.never': 'ещё не было', 'sync.offline': 'Нет сети — синхронизирую позже.',
  'sync.ok': 'Синхронизировано :)', 'sync.loggedAs': 'Аккаунт: {email}',
  'sync.pending': 'Ждут отправки: {n}',
  'sync.mediaNote': 'Картинки хранятся только на этом устройстве (и в JSON-бэкапе).',

  'stats.today': 'Сегодня', 'stats.reviewed': 'повторено', 'stats.newToday': 'новых', 'stats.accuracy': 'точность',
  'stats.time': 'время', 'stats.streak': 'Серия дней', 'stats.best': 'рекорд: {n}',
  'stats.heatmap': 'Активность', 'stats.cards': 'Карточки', 'stats.c.new': 'новые', 'stats.c.learning': 'в изучении',
  'stats.c.young': 'молодые', 'stats.c.mature': 'зрелые', 'stats.forecast': 'Прогноз повторений',
  'stats.diacritics': 'Ошибки в диакритике', 'stats.diacriticsSub': 'за 30 дней (доля от ответов в Písanie)',
  'stats.less': 'меньше', 'stats.more': 'больше', 'stats.days7': '7 дней', 'stats.days30': '30 дней',
  'stats.noData': 'Пока нет данных — начни учить :)',

  'imp.title': 'Импорт из Anki', 'imp.choose': 'Выбрать файл .apkg', 'imp.reading': 'Читаю колоду…',
  'imp.notes': 'Заметок: {n}', 'imp.preview': 'Превью (первые 10)',
  'imp.fieldSk': 'Поле со словацким', 'imp.fieldRu': 'Поле с русским', 'imp.field': 'Поле {n}',
  'imp.deck': 'В колоду', 'imp.newDeck': '+ новая колода…', 'imp.inactive': 'Только в словарь (неактивные)',
  'imp.inactiveHint': 'Слова не попадут в обучение, пока не добавишь их в Словаре.',
  'imp.images': 'Импортировать картинки', 'imp.go': 'Импортировать', 'imp.done': 'Импортировано: {n}, пропущено дублей: {d}',
  'imp.dups': 'Дубли (будут пропущены): {n}',

  'gr.verbs': 'Глаголы', 'gr.nouns': 'Существительные', 'gr.both': 'Всё',
  'gr.present': 'настоящее время', 'gr.sg': 'ед. ч.', 'gr.pl': 'мн. ч.',
  'gr.editor': 'Таблицы форм', 'gr.addVerb': '+ глагол', 'gr.addNoun': '+ существительное',
  'gr.inf': 'Инфинитив', 'gr.lemma': 'Начальная форма', 'gr.translation': 'Перевод (RU)', 'gr.pattern': 'Образец',
  'gr.markVerified': 'Проверено с преподавателем', 'gr.reset': 'Вернуть исходное', 'gr.custom': 'своё',
  'gr.note': 'Сгенерированные формы помечены «neoverené» — проверь их с преподавателем.',
  'case.nom': 'именительный', 'case.gen': 'родительный', 'case.dat': 'дательный', 'case.acc': 'винительный',
  'case.loc': 'предложный', 'case.ins': 'творительный',
};

export const STRINGS = { sk: SK, ru: RU };

export function t(key, vars) {
  const lang = settings().lang === 'ru' ? 'ru' : 'sk';
  let s = STRINGS[lang][key] ?? SK[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  return s;
}

/** Словацкое множественное число: 1 deň, 2–4 dni, 5+ dní. Русское: 1 день, 2–4 дня, 5+ дней. */
export function plural(n, forms) {
  const lang = settings().lang === 'ru' ? 'ru' : 'sk';
  const f = forms[lang];
  if (lang === 'sk') return n === 1 ? f[0] : n >= 2 && n <= 4 ? f[1] : f[2];
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return f[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return f[1];
  return f[2];
}

export const DAYS = { sk: ['deň', 'dni', 'dní'], ru: ['день', 'дня', 'дней'] };
export const WORDS = { sk: ['slovo', 'slová', 'slov'], ru: ['слово', 'слова', 'слов'] };

/** «pred 3 dňami» / «3 дня назад» — для отметок времени. */
export function ago(ts) {
  if (!ts) return null;
  const lang = settings().lang === 'ru' ? 'ru' : 'sk';
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return lang === 'sk' ? 'práve teraz' : 'только что';
  if (min < 60) return lang === 'sk' ? `pred ${min} min` : `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return lang === 'sk' ? `pred ${h} h` : `${h} ч назад`;
  const d = Math.round(h / 24);
  if (lang === 'sk') return d === 1 ? 'včera' : `pred ${d} dňami`;
  return d === 1 ? 'вчера' : `${d} ${plural(d, DAYS)} назад`;
}
