// Тесты импорта .apkg: синтетические колоды всех трёх форматов + реальная колода (если лежит в Downloads).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { decompress } from 'fzstd';
import { parseApkg, cleanField, guessFields, buildNotes, safeId, parseMediaProto } from '../js/import-apkg.js';

const SQL = await initSqlJs();
const zstd = (u8) => decompress(u8);
const deps = { JSZip, SQL, zstd };
const canCompress = typeof zlib.zstdCompressSync === 'function';

const NOTES = [
  ['1', 'g/1', 'dom', 'дом'],
  ['2', 'g2', 'pätnásť<br>15', 'пятнадцать'],
  ['3', 'g3', '<div>hovoríš</div>', '(ты) говоришь&nbsp;'],
  ['4', 'g4', 'obrázok <img src="bad.png">', 'картинка'],
];

/** Собрать SQLite-базу коллекции. legacy=true — модели в col.models (anki2/anki21), иначе таблицы notetypes/fields (anki21b). */
function makeCollection({ legacy = true, stub = false } = {}) {
  const db = new SQL.Database();
  db.run('CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text)');
  if (legacy) {
    db.run('CREATE TABLE col (id integer primary key, models text, decks text)');
    const models = { 111: { name: 'Basic', flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }] } };
    db.run('INSERT INTO col VALUES (1, ?, ?)', [JSON.stringify(models), '{}']);
  } else {
    db.run('CREATE TABLE col (id integer primary key, models text, decks text)');
    db.run("INSERT INTO col VALUES (1, '', '')");
    db.run('CREATE TABLE notetypes (id integer primary key, name text)');
    db.run('CREATE TABLE fields (ntid integer, ord integer, name text)');
    db.run("INSERT INTO notetypes VALUES (111, 'Basic')");
    db.run("INSERT INTO fields VALUES (111, 0, 'Slovensky'), (111, 1, 'Rusky')");
  }
  const rows = stub ? [['9', 'stub', 'Please update to the latest Anki version, then import the .colpkg/.apkg file again.', '']] : NOTES;
  for (const [id, guid, a, b] of rows) {
    db.run('INSERT INTO notes (id, guid, mid, tags, flds) VALUES (?, ?, 111, ?, ?)', [Number(id), guid, '', `${a}\x1f${b}`]);
  }
  const bytes = db.export();
  db.close();
  return bytes;
}

/** protobuf MediaEntries с одной записью name=bad.png */
function mediaProto(name) {
  const nameBytes = new TextEncoder().encode(name);
  const entry = [0x0a, nameBytes.length, ...nameBytes, 0x10, 3];
  return new Uint8Array([0x0a, entry.length, ...entry]);
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

test('anki21 + заглушка в anki2: берётся anki21, поля и картинки', async () => {
  const zip = new JSZip();
  zip.file('collection.anki2', makeCollection({ stub: true }));
  zip.file('collection.anki21', makeCollection());
  zip.file('media', JSON.stringify({ 0: 'bad.png' }));
  zip.file('0', PNG);
  const parsed = await parseApkg(await zip.generateAsync({ type: 'uint8array' }), deps);
  assert.equal(parsed.source, 'anki21');
  assert.equal(parsed.notes.length, 4);
  assert.deepEqual(parsed.fieldNames, ['Front', 'Back']);
  assert.deepEqual(parsed.mediaNames, ['bad.png']);
  assert.deepEqual([...(await parsed.readMedia('bad.png'))], [...PNG]);
});

test('только заглушка — понятная ошибка', async () => {
  const zip = new JSZip();
  zip.file('collection.anki2', makeCollection({ stub: true }));
  await assert.rejects(parseApkg(await zip.generateAsync({ type: 'uint8array' }), deps), (e) => e.code === 'stub');
});

test('anki21b без декодера zstd — понятная ошибка', async () => {
  const zip = new JSZip();
  zip.file('collection.anki21b', new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0]));
  await assert.rejects(parseApkg(await zip.generateAsync({ type: 'uint8array' }), { ...deps, zstd: null }), (e) => e.code === 'zstd');
});

test('anki21b (zstd + новая схема + media в protobuf)', { skip: !canCompress && 'нет zlib.zstdCompressSync' }, async () => {
  const zip = new JSZip();
  zip.file('collection.anki2', makeCollection({ stub: true }));
  zip.file('collection.anki21b', zlib.zstdCompressSync(makeCollection({ legacy: false })));
  zip.file('media', zlib.zstdCompressSync(mediaProto('bad.png')));
  zip.file('0', zlib.zstdCompressSync(PNG));
  const parsed = await parseApkg(await zip.generateAsync({ type: 'uint8array' }), deps);
  assert.equal(parsed.source, 'anki21b');
  assert.deepEqual(parsed.fieldNames, ['Slovensky', 'Rusky']);
  assert.equal(parsed.notes.length, 4);
  assert.deepEqual([...(await parsed.readMedia('bad.png'))], [...PNG]);
});

test('protobuf media: имя и номер файла', () => {
  assert.deepEqual(parseMediaProto(mediaProto('a.jpg')), [{ name: 'a.jpg', zipName: '0' }]);
});

test('очистка HTML: <br> → перенос, теги и сущности, картинки', () => {
  assert.deepEqual(cleanField('pätnásť<br>15'), { text: 'pätnásť\n15', images: [] });
  assert.deepEqual(cleanField('<div>hovoríš</div><div>ty</div>'), { text: 'hovoríš\nty', images: [] });
  assert.equal(cleanField('a&nbsp;&amp;&nbsp;b &#269;&#x161;').text, 'a & b čš');
  assert.deepEqual(cleanField('<b>pes</b> <img src="dog.jpg"/>[sound:pes.mp3]'), { text: 'pes', images: ['dog.jpg'] });
});

test('угадывание полей и сборка слов: дубли пропускаются, id без «/»', () => {
  const parsed = { notes: NOTES.map(([id, guid, a, b]) => ({ id, guid, fields: [a, b] })) };
  assert.deepEqual(guessFields(parsed.notes), { sk: 0, ru: 1 });
  const existing = new Set(['dom|дом']);
  const r = buildNotes(parsed, { skField: 0, ruField: 1, deckId: 'deck-slovnik', existingKeys: existing, now: 1000 });
  assert.equal(r.dups, 1);
  assert.equal(r.notes.length, 3);
  assert.equal(r.notes[0].sk, 'pätnásť\n15');
  assert.equal(r.notes[1].ru, '(ты) говоришь');
  assert.equal(r.notes[0].active, false);
  assert.deepEqual(r.images, [{ noteId: 'anki-g4', name: 'bad.png' }]);
  assert.equal(safeId('g/1'), 'g_2f1');
});

// Реальная колода пользователя (в репо не лежит, .apkg в .gitignore)
const REAL = join(homedir(), 'Downloads', 'Slovakian_-_Russian_words_1319_items__-_.apkg');
test('реальная колода Slovakian–Russian (1319 слов)', { skip: !existsSync(REAL) && 'файла нет' }, async () => {
  const parsed = await parseApkg(readFileSync(REAL), deps);
  assert.equal(parsed.notes.length, 1319);
  const g = guessFields(parsed.notes);
  assert.deepEqual(g, { sk: 0, ru: 1 });
  const r = buildNotes(parsed, { skField: g.sk, ruField: g.ru, deckId: 'deck-slovnik' });
  assert.ok(r.notes.length > 1250, `слов: ${r.notes.length}`);
  assert.ok(r.notes.every((n) => n.sk && n.ru && !/[<>]/.test(n.sk + n.ru)));
  assert.ok(r.notes.every((n) => !n.id.includes('/')));
});
