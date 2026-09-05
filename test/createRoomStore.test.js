import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../server/storage/createRoomStore.js';

test('selects PostgreSQL when DATABASE_URL is configured', () => {
  const pool = { query() {}, end() {} };
  const store = createRoomStore({
    databaseUrl: 'postgresql://example.invalid/trips',
    dataDir: 'unused',
    pool
  });
  assert.equal(store.kind, 'postgresql');
});

test('selects file storage when DATABASE_URL is absent', () => {
  const store = createRoomStore({ databaseUrl: '', dataDir: 'server/data' });
  assert.equal(store.kind, 'file');
});
