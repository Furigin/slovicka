import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, validateBackup, restorePlan, blobToBase64, base64ToBlob } from '../js/backup-format.js';

const local = {
  decks: [{ id: 'd1', name: 'Moje chyby', updatedAt: 10 }],
  notes: [{ id: 'a', sk: 'dom', updatedAt: 100 }, { id: 'b', sk: 'stôl', updatedAt: 100 }],
  meta: [{ key: 'settings', value: { lang: 'sk' }, updatedAt: 5 }, { key: 'lastPull', value: 1, updatedAt: 5 }],
};

test('бэкап: только наши хранилища, служебные meta не попадают', () => {
  const b = buildBackup(local, [], 123);
  assert.equal(b.app, 'slovicka');
  assert.equal(b.exportedAt, 123);
  assert.deepEqual(b.stores.meta.map((m) => m.key), ['settings']);
  assert.deepEqual(b.stores.cards, []);
  assert.equal(validateBackup(JSON.parse(JSON.stringify(b))), null);
});

test('чужой файл отклоняется', () => {
  assert.equal(validateBackup({ foo: 1 }), 'not-slovicka');
  assert.equal(validateBackup(null), 'not-slovicka');
  assert.equal(validateBackup({ app: 'slovicka', format: 99, stores: {} }), 'format');
});

test('merge: берём только новые и более свежие записи', () => {
  const backup = buildBackup({
    notes: [{ id: 'a', sk: 'dom!', updatedAt: 200 }, { id: 'b', sk: 'old', updatedAt: 50 }, { id: 'c', sk: 'nové', updatedAt: 1 }],
  });
  const plan = restorePlan(local, backup, 'merge');
  assert.deepEqual(plan.put.notes.map((n) => n.id).sort(), ['a', 'c']);
  assert.deepEqual(plan.del.notes, []);
});

test('replace: всё из бэкапа, лишнее локальное удаляется (кроме служебных meta)', () => {
  const backup = buildBackup({ notes: [{ id: 'a', sk: 'dom', updatedAt: 1 }] });
  const plan = restorePlan(local, backup, 'replace');
  assert.deepEqual(plan.put.notes.map((n) => n.id), ['a']);
  assert.deepEqual(plan.del.notes, ['b']);
  assert.deepEqual(plan.del.decks, ['d1']);
  assert.deepEqual(plan.del.meta, ['settings']);
});

test('картинки: base64 туда и обратно', async () => {
  const blob = new Blob([new Uint8Array([0, 1, 2, 250, 255])], { type: 'image/png' });
  const b64 = await blobToBase64(blob);
  const back = new Uint8Array(await base64ToBlob(b64, 'image/png').arrayBuffer());
  assert.deepEqual([...back], [0, 1, 2, 250, 255]);
});
