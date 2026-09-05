import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStateService } from '../server/roomStateService.js';
import { VersionConflictError } from '../server/storage/roomStoreErrors.js';

class InMemoryRoomStore {
  constructor() {
    this.kind = 'memory';
    this.records = new Map();
    this.failNextSave = false;
  }

  async init() {}

  async load(roomId) {
    const record = this.records.get(roomId);
    return record ? structuredClone(record) : null;
  }

  async createIfAbsent(roomId, initialState) {
    const existing = await this.load(roomId);
    if (existing) return existing;
    const record = {
      roomId,
      state: structuredClone(initialState),
      version: 1,
      updatedAt: new Date().toISOString()
    };
    this.records.set(roomId, structuredClone(record));
    return structuredClone(record);
  }

  async save(roomId, state, expectedVersion) {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('save failed');
    }
    const current = this.records.get(roomId);
    if (!current || current.version !== expectedVersion) {
      throw new VersionConflictError(roomId);
    }
    const record = {
      roomId,
      state: structuredClone(state),
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    this.records.set(roomId, structuredClone(record));
    return structuredClone(record);
  }

  async close() {}
}

test('a second service instance restores the first instance room', async () => {
  const store = new InMemoryRoomStore();
  const first = new RoomStateService({ store });
  const created = await first.getOrCreate('tokyo-2026', {
    tripTitle: '東京行', members: [], expenses: []
  });
  await first.update('TOKYO-2026', (state) => ({
    ...state, expenses: [{ id: 'e1', title: 'Suica' }]
  }));

  const restarted = new RoomStateService({ store });
  const restored = await restarted.getOrCreate('TOKYO-2026', {
    tripTitle: '舊快取', members: [], expenses: []
  });

  assert.equal(created.version, 1);
  assert.equal(restored.version, 2);
  assert.equal(restored.state.expenses[0].title, 'Suica');
});

test('an existing server room wins over client cache', async () => {
  const store = new InMemoryRoomStore();
  const service = new RoomStateService({ store });
  await service.getOrCreate('SHARED', {
    tripTitle: '中央資料', members: [{ id: 'm1', name: '小明' }], expenses: []
  });
  const record = await service.getOrCreate('SHARED', {
    tripTitle: '舊手機', members: [], expenses: []
  });
  assert.equal(record.state.tripTitle, '中央資料');
  assert.equal(record.state.members.length, 1);
});

test('failed persistence leaves the authoritative in-memory state unchanged', async () => {
  const store = new InMemoryRoomStore();
  const service = new RoomStateService({ store });
  const before = await service.getOrCreate('SHARED', {
    tripTitle: '東京行', members: [], expenses: []
  });
  store.failNextSave = true;
  await assert.rejects(service.update('SHARED', (state) => ({
    ...state, expenses: [{ id: 'e1' }]
  })), /save failed/);
  assert.deepEqual(await service.getOrCreate('SHARED'), before);
});

test('concurrent updates to one room are serialized', async () => {
  const store = new InMemoryRoomStore();
  const service = new RoomStateService({ store });
  await service.getOrCreate('SHARED', {
    tripTitle: '東京行', members: [], expenses: []
  });
  await Promise.all([
    service.update('SHARED', (state) => ({
      ...state, expenses: [...state.expenses, { id: 'e1' }]
    })),
    service.update('SHARED', (state) => ({
      ...state, expenses: [...state.expenses, { id: 'e2' }]
    }))
  ]);
  const result = await service.getOrCreate('SHARED');
  assert.deepEqual(result.state.expenses.map(({ id }) => id), ['e1', 'e2']);
  assert.equal(result.version, 3);
});
