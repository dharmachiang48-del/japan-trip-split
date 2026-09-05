import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FileRoomStore } from '../server/storage/fileRoomStore.js';
import { VersionConflictError } from '../server/storage/roomStoreErrors.js';

const initialState = {
  tripTitle: '東京行',
  members: [{ id: 'm1', name: '小明' }],
  expenses: []
};

test('file store survives a new store instance', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'trip-room-store-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));

  const first = new FileRoomStore({ dataDir });
  await first.init();
  const created = await first.createIfAbsent('TOKYO-2026', initialState);
  const saved = await first.save(
    'TOKYO-2026',
    { ...initialState, expenses: [{ id: 'e1', title: '車票' }] },
    created.version
  );

  const restarted = new FileRoomStore({ dataDir });
  await restarted.init();
  const loaded = await restarted.load('TOKYO-2026');
  assert.deepEqual(loaded, saved);
});

test('file store keeps an existing room when another client tries to create it', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'trip-room-store-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const store = new FileRoomStore({ dataDir });
  await store.init();

  const existing = await store.createIfAbsent('SHARED', initialState);
  const result = await store.createIfAbsent('SHARED', {
    tripTitle: '舊快取', members: [], expenses: []
  });

  assert.deepEqual(result, existing);
});

test('file store rejects a stale version', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'trip-room-store-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const store = new FileRoomStore({ dataDir });
  await store.init();
  await store.createIfAbsent('SHARED', initialState);

  await assert.rejects(
    store.save('SHARED', initialState, 0),
    VersionConflictError
  );
});
