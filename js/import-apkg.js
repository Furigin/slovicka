// Импорт колод Anki (.apkg) прямо в браузере.
//
// .apkg — это zip:
//   collection.anki21b  — SQLite, сжатый zstd (новые версии Anki)      ← берём первым, если есть декодер
//   collection.anki21   — SQLite (Anki 2.1.x)                           ← иначе этот
//   collection.anki2    — SQLite старого формата; у новых колод тут заглушка
//                         «Please update to the latest Anki version»
//   media               — JSON {"0": "bad.png", …}  (или zstd+protobuf в новых колодах)
//   0, 1, 2…            — сами файлы картинок (в новых колодах тоже сжаты zstd)
//
// Зависимости передаются снаружи (deps), поэтому модуль работает и в браузере, и в Node-тестах:
//   deps = { JSZip, SQL /* инициализированный sql.js */, zstd /* (Uint8Array) => Uint8Array | null */ }

import { hasCyrillic, searchKey } from './textutil.js';

const STUB_TEXT = 'Please update to the latest Anki version';
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

export class ApkgError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const isZstd = (u8) => u8 && u8.length > 4 && ZSTD_MAGIC.every((b, i) => u8[i] === b);

// ---------- Очистка HTML из полей ----------
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };

/** Поле Anki → { text, images }. <br>/<div> → перенос строки, теги убираются, сущности раскодируются. */
export function cleanField(html) {
  const images = [];
  const src = String(html || '');
  src.replace(/<img[^>]*?src\s*=\s*["']?([^"'>\s]+)["']?[^>]*>/gi, (_, name) => { images.push(decodeEntities(name)); return ''; });
  let s = src
    .replace(/\[sound:[^\]]*\]/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|h\d)>/gi, '\n')
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s)
    .split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
  return { text: s, images };
}

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// ---------- Минимальный разбор protobuf (файл media в новых колодах) ----------
function readVarint(buf, pos) {
  let result = 0, shift = 0, b;
  do {
    b = buf[pos++];
    result += (b & 0x7f) * 2 ** shift;
    shift += 7;
  } while (b & 0x80);
  return [result, pos];
}

/** MediaEntries { repeated MediaEntry entries = 1 }, MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; uint32 legacy_zip_filename = 255 } */
export function parseMediaProto(buf) {
  const out = [];
  let pos = 0;
  const dec = new TextDecoder();
  while (pos < buf.length) {
    let tag; [tag, pos] = readVarint(buf, pos);
    const field = Math.floor(tag / 8), wire = tag & 7;
    if (wire !== 2) throw new ApkgError('media', 'Neznámy formát súboru media');
    let len; [len, pos] = readVarint(buf, pos);
    const sub = buf.subarray(pos, pos + len);
    pos += len;
    if (field !== 1) continue;
    const entry = { name: '', zipName: null };
    let p = 0;
    while (p < sub.length) {
      let t2; [t2, p] = readVarint(sub, p);
      const f2 = Math.floor(t2 / 8), w2 = t2 & 7;
      if (w2 === 0) { let v; [v, p] = readVarint(sub, p); if (f2 === 255) entry.zipName = String(v); }
      else if (w2 === 2) {
        let l2; [l2, p] = readVarint(sub, p);
        if (f2 === 1) entry.name = dec.decode(sub.subarray(p, p + l2));
        p += l2;
      } else throw new ApkgError('media', 'Neznámy formát súboru media');
    }
    out.push(entry);
  }
  // имя файла в архиве — порядковый номер (или legacy_zip_filename)
  return out.map((e, i) => ({ name: e.name, zipName: e.zipName ?? String(i) }));
}

// ---------- Разбор архива ----------
/**
 * @returns {{ notes, models, fieldNames, mediaNames, readMedia(name), source }}
 *   notes: [{ id, guid, modelId, fields: [raw html], tags }]
 */
export async function parseApkg(data, deps) {
  const { JSZip, SQL, zstd } = deps;
  const zip = await JSZip.loadAsync(data);
  const has = (n) => !!zip.file(n);

  let bytes = null, source = null;
  if (has('collection.anki21b') && zstd) {
    bytes = zstd(await zip.file('collection.anki21b').async('uint8array'));
    source = 'anki21b';
  } else if (has('collection.anki21')) {
    bytes = await zip.file('collection.anki21').async('uint8array');
    source = 'anki21';
  } else if (has('collection.anki2')) {
    bytes = await zip.file('collection.anki2').async('uint8array');
    source = 'anki2';
  } else if (has('collection.anki21b')) {
    throw new ApkgError('zstd', 'Balíček je v novom formáte (anki21b) a dekodér zstd nie je dostupný.');
  } else {
    throw new ApkgError('not-apkg', 'Toto nie je balíček Anki (.apkg).');
  }

  const db = new SQL.Database(bytes);
  try {
    const rows = (sql) => {
      const res = db.exec(sql);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
    };
    const tableExists = (name) => rows(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`).length > 0;

    // Типы заметок и имена полей
    const models = {};
    const colRow = rows('SELECT models FROM col')[0];
    const legacyModels = colRow?.models ? JSON.parse(colRow.models || '{}') : {};
    for (const [id, m] of Object.entries(legacyModels)) {
      models[id] = { name: m.name, fields: [...(m.flds || [])].sort((a, b) => a.ord - b.ord).map((f) => f.name) };
    }
    if (!Object.keys(models).length && tableExists('notetypes') && tableExists('fields')) {
      for (const nt of rows('SELECT id, name FROM notetypes')) models[String(nt.id)] = { name: nt.name, fields: [] };
      for (const f of rows('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord')) {
        (models[String(f.ntid)] ||= { name: '?', fields: [] }).fields[f.ord] = f.name;
      }
    }

    const notes = rows('SELECT id, guid, mid, flds, tags FROM notes ORDER BY id').map((r) => ({
      id: String(r.id), guid: String(r.guid), modelId: String(r.mid),
      fields: String(r.flds).split('\x1f'), tags: String(r.tags || '').trim(),
    }));

    if (notes.length <= 2 && notes.some((n) => n.fields.join(' ').includes(STUB_TEXT))) {
      throw new ApkgError(has('collection.anki21b') ? 'zstd' : 'stub',
        'V balíčku je len zástupná poznámka „Please update to the latest Anki version“. Exportuj balíček v Anki s voľbou „Podpora starších verzií“.');
    }

    // Медиа: имя файла → имя записи в zip
    const mediaMap = new Map();
    if (has('media')) {
      const raw = await zip.file('media').async('uint8array');
      let parsed = null;
      try { parsed = JSON.parse(new TextDecoder().decode(raw)); } catch { /* не JSON */ }
      if (parsed && typeof parsed === 'object') {
        for (const [zipName, name] of Object.entries(parsed)) mediaMap.set(name, zipName);
      } else if (zstd) {
        const buf = isZstd(raw) ? zstd(raw) : raw;
        for (const e of parseMediaProto(buf)) mediaMap.set(e.name, e.zipName);
      }
    }

    // Самый частый тип заметок — его поля показываем в превью
    const counts = {};
    notes.forEach((n) => { counts[n.modelId] = (counts[n.modelId] || 0) + 1; });
    const mainModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const maxFields = Math.max(0, ...notes.map((n) => n.fields.length));
    const fieldNames = Array.from({ length: maxFields }, (_, i) => models[mainModel]?.fields?.[i] || `${i + 1}`);

    return {
      source, notes, models, fieldNames,
      mediaNames: [...mediaMap.keys()],
      async readMedia(name) {
        const zipName = mediaMap.get(name);
        const f = zipName !== undefined && zip.file(zipName);
        if (!f) return null;
        let u8 = await f.async('uint8array');
        if (isZstd(u8) && zstd) u8 = zstd(u8);
        return u8;
      },
    };
  } finally {
    db.close();
  }
}

/** Угадать, какое поле словацкое, какое русское (по кириллице в первых заметках). */
export function guessFields(notes) {
  const sample = notes.slice(0, 60);
  const n = Math.max(0, ...sample.map((x) => x.fields.length));
  const score = Array.from({ length: n }, () => ({ cyr: 0, lat: 0 }));
  for (const note of sample) {
    note.fields.forEach((f, i) => {
      const { text } = cleanField(f);
      if (!text) return;
      if (hasCyrillic(text)) score[i].cyr++;
      else if (/[a-záäčďéíĺľňóôŕšťúýž]/i.test(text)) score[i].lat++;
    });
  }
  const ru = score.reduce((best, s, i) => (s.cyr > score[best].cyr ? i : best), 0);
  let sk = ru === 0 ? 1 : 0;
  score.forEach((s, i) => { if (i !== ru && s.lat > score[sk].lat) sk = i; });
  return { sk: Math.min(sk, n - 1), ru };
}

/** Безопасный id из guid Anki (в id Firestore нельзя «/»). */
export function safeId(guid) {
  return Array.from(guid).map((c) => (/[A-Za-z0-9]/.test(c) ? c : `_${c.codePointAt(0).toString(16)}`)).join('');
}

/**
 * Превратить заметки Anki в слова приложения.
 * @param existingKeys  Set ключей 'sk|ru' уже существующих слов (для пропуска дублей)
 * @returns {{ notes, dups, images: [{ noteId, name }] }}
 */
export function buildNotes(parsed, { skField, ruField, deckId, active = false, existingKeys = new Set(), now = Date.now() }) {
  const out = [], images = [];
  const seen = new Set(existingKeys);
  let dups = 0;
  parsed.notes.forEach((n, i) => {
    const skC = cleanField(n.fields[skField]);
    const ruC = cleanField(n.fields[ruField]);
    if (!skC.text || !ruC.text) return;
    const key = `${searchKey(skC.text)}|${searchKey(ruC.text)}`;
    if (seen.has(key)) { dups++; return; }
    seen.add(key);
    const id = `anki-${safeId(n.guid)}`;
    // картинка — первая найденная в любом поле заметки
    const img = n.fields.flatMap((f) => cleanField(f).images)[0] || null;
    if (img) images.push({ noteId: id, name: img });
    // пример — первое из остальных полей с текстом (если есть)
    const other = n.fields.map((f, j) => (j === skField || j === ruField ? '' : cleanField(f).text)).find(Boolean) || '';
    out.push({
      id, sk: skC.text, ru: ruC.text, example: other.length <= 200 ? other : '',
      deckId, active, img: null, source: 'anki', createdAt: now + i, order: now + i,
    });
  });
  return { notes: out, dups, images };
}

export const noteKey = (n) => `${searchKey(n.sk)}|${searchKey(n.ru)}`;

/** MIME по расширению картинки. */
export function mimeOf(name) {
  const ext = name.split('.').pop().toLowerCase();
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
}
