import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCachedRoom,
  saveServerRoom,
  shouldApplyServerVersion
} from '../src/utils/roomCache.js';

test('server versions are authoritative and reject older events', () => {
  assert.equal(shouldApplyServerVersion(3, 4), true);
  assert.equal(shouldApplyServerVersion(3, 3), true);
  assert.equal(shouldApplyServerVersion(3, 2), false);
});

test('server room state is saved under room-scoped cache keys', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  saveServerRoom('OSAKA', {
    tripTitle: '大阪行', members: [], expenses: [{ id: 'e1' }], version: 7
  }, storage);
  const cached = loadCachedRoom('OSAKA', {
    tripTitle: '預設', members: [], expenses: []
  }, storage);
  assert.equal(cached.tripTitle, '大阪行');
  assert.equal(cached.version, 7);
  assert.equal(cached.expenses[0].id, 'e1');
});
