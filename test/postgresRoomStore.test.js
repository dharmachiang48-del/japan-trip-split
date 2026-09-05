import test from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { PostgresRoomStore } from '../server/storage/postgresRoomStore.js';
import { VersionConflictError } from '../server/storage/roomStoreErrors.js';

async function createStore() {
  const memoryDb = newDb();
  const { Pool } = memoryDb.adapters.createPg();
  const store = new PostgresRoomStore({ pool: new Pool() });
  await store.init();
  return store;
}

const state = { tripTitle: '大阪行', members: [], expenses: [] };

test('postgres store creates, saves, and reloads a room with increasing versions', async (t) => {
  const store = await createStore();
  t.after(() => store.close());
  const created = await store.createIfAbsent('OSAKA', state);
  const saved = await store.save(
    'OSAKA',
    { ...state, members: [{ id: 'm1', name: '阿美' }] },
    created.version
  );
  assert.equal(created.version, 1);
  assert.equal(saved.version, 2);
  assert.deepEqual(await store.load('OSAKA'), saved);
});

test('postgres store does not replace an existing room during createIfAbsent', async (t) => {
  const store = await createStore();
  t.after(() => store.close());
  const existing = await store.createIfAbsent('OSAKA', state);
  const result = await store.createIfAbsent('OSAKA', {
    tripTitle: '舊快取', members: [], expenses: []
  });
  assert.deepEqual(result, existing);
});

test('postgres store rejects a stale expected version', async (t) => {
  const store = await createStore();
  t.after(() => store.close());
  await store.createIfAbsent('OSAKA', state);
  await assert.rejects(store.save('OSAKA', state, 0), VersionConflictError);
});
