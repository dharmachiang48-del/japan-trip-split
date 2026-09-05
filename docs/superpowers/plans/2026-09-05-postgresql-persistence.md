# PostgreSQL Room Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Render's ephemeral room JSON as the production source of truth with durable PostgreSQL storage while preserving real-time multi-user WebSocket updates.

**Architecture:** A provider-neutral `RoomStore` contract has PostgreSQL and local-file implementations. `RoomStateService` owns authoritative room records, serializes updates per room, persists each next state before exposing it, and returns monotonically increasing server versions. The WebSocket server broadcasts committed full states; browser storage is only a room-scoped cache and can seed a room only when the database has no such room.

**Tech Stack:** Node.js 20, Express 5, `ws`, PostgreSQL via `pg`, tests via `node:test`, PostgreSQL contract tests via `pg-mem`, React 18, Vite 5.

**Spec:** `docs/superpowers/specs/2026-09-05-postgresql-persistence-design.md`

## Global Constraints

- `DATABASE_URL` is read only from the environment and is never committed.
- PostgreSQL is authoritative whenever a room already exists; client timestamps never overwrite an existing server record.
- A successful WebSocket state event is emitted only after persistence succeeds.
- Room versions are assigned by the server and increase monotonically.
- When `DATABASE_URL` is absent, local development uses `server/data` JSON records.
- Existing room-scoped browser-cache changes are retained where compatible; unrelated working-tree changes are preserved.
- Runtime room JSON files remain untracked, and the three previously committed sample room JSON files remain deleted.

---

### Task 1: Test Harness and Local File Room Store

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/storage/roomStoreErrors.js`
- Create: `server/storage/fileRoomStore.js`
- Create: `test/fileRoomStore.test.js`

**Interfaces:**
- Produces: `new FileRoomStore({ dataDir })` with `kind`, `init()`, `load(roomId)`, `createIfAbsent(roomId, initialState)`, `save(roomId, state, expectedVersion)`, and `close()`.
- Produces: `VersionConflictError` for stale expected versions.
- Record shape: `{ roomId: string, state: RoomState, version: number, updatedAt: string }`.

- [ ] **Step 1: Add the test command without adding production dependencies yet**

Change `package.json` scripts to include:

```json
"test": "node --test --test-concurrency=1"
```

Run `npm install --package-lock-only` so `package-lock.json` remains consistent.

- [ ] **Step 2: Write the failing local-store tests**

Create `test/fileRoomStore.test.js` using a real temporary directory:

```js
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
```

- [ ] **Step 3: Run the tests and verify the intended RED state**

Run: `npm test -- test/fileRoomStore.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `server/storage/fileRoomStore.js`.

- [ ] **Step 4: Implement the minimal file store**

Create `server/storage/roomStoreErrors.js`:

```js
export class VersionConflictError extends Error {
  constructor(roomId) {
    super(`Room version conflict: ${roomId}`);
    this.name = 'VersionConflictError';
  }
}
```

Create `server/storage/fileRoomStore.js` with these rules:

```js
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { VersionConflictError } from './roomStoreErrors.js';

const clone = (value) => structuredClone(value);

export class FileRoomStore {
  constructor({ dataDir }) {
    this.kind = 'file';
    this.dataDir = dataDir;
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
  }

  filePath(roomId) {
    const safeId = Buffer.from(roomId, 'utf8').toString('hex');
    return path.join(this.dataDir, `room_${safeId}.json`);
  }

  async load(roomId) {
    try {
      return JSON.parse(await readFile(this.filePath(roomId), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async createIfAbsent(roomId, initialState) {
    const existing = await this.load(roomId);
    if (existing) return clone(existing);
    const record = {
      roomId,
      state: clone(initialState),
      version: 1,
      updatedAt: new Date().toISOString()
    };
    try {
      await writeFile(this.filePath(roomId), JSON.stringify(record, null, 2), {
        encoding: 'utf8', flag: 'wx'
      });
      return clone(record);
    } catch (error) {
      if (error.code === 'EEXIST') return clone(await this.load(roomId));
      throw error;
    }
  }

  async save(roomId, state, expectedVersion) {
    const current = await this.load(roomId);
    if (!current || current.version !== expectedVersion) {
      throw new VersionConflictError(roomId);
    }
    const record = {
      roomId,
      state: clone(state),
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    const target = this.filePath(roomId);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(record, null, 2), 'utf8');
    await rename(temporary, target);
    return clone(record);
  }

  async close() {}
}
```

- [ ] **Step 5: Run local-store tests and the full test command**

Run: `npm test -- test/fileRoomStore.test.js`

Expected: 3 tests pass.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit Task 1 without absorbing unrelated working-tree changes**

```powershell
git add package.json package-lock.json server/storage/roomStoreErrors.js server/storage/fileRoomStore.js test/fileRoomStore.test.js
git commit --only -m "test: define durable room store contract" -- package.json package-lock.json server/storage/roomStoreErrors.js server/storage/fileRoomStore.js test/fileRoomStore.test.js
```

Before committing, inspect `git diff --cached --name-only`. The explicit `--only` path list prevents the pre-existing staged runtime-JSON deletions or any other user change from entering this commit.

---

### Task 2: PostgreSQL Room Store and Environment Selection

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/storage/postgresRoomStore.js`
- Create: `server/storage/createRoomStore.js`
- Create: `test/postgresRoomStore.test.js`
- Create: `test/createRoomStore.test.js`

**Interfaces:**
- Consumes: `VersionConflictError` and the Task 1 RoomStore record shape.
- Produces: `new PostgresRoomStore({ pool })` implementing the same RoomStore methods.
- Produces: `createRoomStore({ databaseUrl, dataDir, pool })`; returns PostgreSQL when `databaseUrl` is truthy, otherwise file storage.

- [ ] **Step 1: Install PostgreSQL runtime and in-memory test dependencies**

Run:

```powershell
npm install pg@^8.16.3
npm install --save-dev pg-mem@^3.0.5
```

Keep the versions resolved by npm in `package-lock.json`; do not hand-edit the lockfile.

- [ ] **Step 2: Write failing PostgreSQL contract tests**

Create `test/postgresRoomStore.test.js`:

```js
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
```

Create `test/createRoomStore.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../server/storage/createRoomStore.js';

test('selects PostgreSQL when DATABASE_URL is configured', () => {
  const pool = { query() {}, end() {} };
  const store = createRoomStore({
    databaseUrl: 'postgresql://example.invalid/trips', dataDir: 'unused', pool
  });
  assert.equal(store.kind, 'postgresql');
});

test('selects file storage when DATABASE_URL is absent', () => {
  const store = createRoomStore({ databaseUrl: '', dataDir: 'server/data' });
  assert.equal(store.kind, 'file');
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run: `npm test -- test/postgresRoomStore.test.js test/createRoomStore.test.js`

Expected: FAIL with missing `postgresRoomStore.js` and `createRoomStore.js` modules.

- [ ] **Step 4: Implement the PostgreSQL store**

Create `server/storage/postgresRoomStore.js`. Use parameterized statements and normalize PostgreSQL `BIGINT` to a JavaScript number:

```js
import pg from 'pg';
import { VersionConflictError } from './roomStoreErrors.js';

const toRecord = (row) => row ? ({
  roomId: row.room_id,
  state: row.state,
  version: Number(row.version),
  updatedAt: new Date(row.updated_at).toISOString()
}) : null;

export class PostgresRoomStore {
  constructor({ databaseUrl, pool } = {}) {
    this.kind = 'postgresql';
    this.pool = pool ?? new pg.Pool({ connectionString: databaseUrl });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        room_id TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        version BIGINT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async load(roomId) {
    const result = await this.pool.query(
      'SELECT room_id, state, version, updated_at FROM rooms WHERE room_id = $1',
      [roomId]
    );
    return toRecord(result.rows[0]);
  }

  async createIfAbsent(roomId, initialState) {
    await this.pool.query(
      `INSERT INTO rooms (room_id, state, version)
       VALUES ($1, $2::jsonb, 1)
       ON CONFLICT (room_id) DO NOTHING`,
      [roomId, JSON.stringify(initialState)]
    );
    return this.load(roomId);
  }

  async save(roomId, state, expectedVersion) {
    const result = await this.pool.query(
      `UPDATE rooms
       SET state = $2::jsonb, version = version + 1, updated_at = NOW()
       WHERE room_id = $1 AND version = $3
       RETURNING room_id, state, version, updated_at`,
      [roomId, JSON.stringify(state), expectedVersion]
    );
    if (!result.rows[0]) throw new VersionConflictError(roomId);
    return toRecord(result.rows[0]);
  }

  async close() {
    await this.pool.end();
  }
}
```

- [ ] **Step 5: Implement environment-based store selection**

Create `server/storage/createRoomStore.js`:

```js
import { FileRoomStore } from './fileRoomStore.js';
import { PostgresRoomStore } from './postgresRoomStore.js';

export function createRoomStore({ databaseUrl, dataDir, pool } = {}) {
  if (databaseUrl) return new PostgresRoomStore({ databaseUrl, pool });
  return new FileRoomStore({ dataDir });
}
```

- [ ] **Step 6: Run focused and full tests**

Run: `npm test -- test/postgresRoomStore.test.js test/createRoomStore.test.js`

Expected: 5 tests pass.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 7: Commit Task 2**

```powershell
git add package.json package-lock.json server/storage/postgresRoomStore.js server/storage/createRoomStore.js test/postgresRoomStore.test.js test/createRoomStore.test.js
git commit --only -m "feat: add PostgreSQL room storage" -- package.json package-lock.json server/storage/postgresRoomStore.js server/storage/createRoomStore.js test/postgresRoomStore.test.js test/createRoomStore.test.js
```

The explicit `--only` path list prevents pre-existing staged changes from being absorbed.

---

### Task 3: Authoritative Room State Service

**Files:**
- Create: `server/roomStateService.js`
- Create: `test/roomStateService.test.js`

**Interfaces:**
- Consumes: a RoomStore from Tasks 1–2.
- Produces: `normalizeRoomId(value)`, `normalizeRoomState(value)`, and `new RoomStateService({ store })`.
- `getOrCreate(roomId, clientState)` returns a RoomStore record.
- `update(roomId, updateState)` persists and returns a new RoomStore record.

- [ ] **Step 1: Write failing service tests with a real in-memory store fake**

Create `test/roomStateService.test.js` with an `InMemoryRoomStore` that implements the RoomStore contract over a `Map`. Include these tests:

```js
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
```

The fake must clone inputs/outputs and increment versions exactly like production; it must not assert call counts.

- [ ] **Step 2: Run the service tests and verify RED**

Run: `npm test -- test/roomStateService.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `server/roomStateService.js`.

- [ ] **Step 3: Implement normalization and serialized persistence**

Create `server/roomStateService.js` with:

```js
export const DEFAULT_TRIP_TITLE = '2026 日本東京自由行 🎌';

export function normalizeRoomId(value) {
  return String(value || 'TOKYO-2026').trim().toUpperCase() || 'TOKYO-2026';
}

export function normalizeRoomState(value) {
  return {
    tripTitle: typeof value?.tripTitle === 'string' && value.tripTitle.trim()
      ? value.tripTitle : DEFAULT_TRIP_TITLE,
    members: Array.isArray(value?.members) ? structuredClone(value.members) : [],
    expenses: Array.isArray(value?.expenses) ? structuredClone(value.expenses) : []
  };
}

export class RoomStateService {
  constructor({ store }) {
    this.store = store;
    this.records = new Map();
    this.pending = new Map();
  }

  async getOrCreate(roomId, clientState) {
    const id = normalizeRoomId(roomId);
    if (this.records.has(id)) return structuredClone(this.records.get(id));
    const stored = await this.store.load(id);
    const record = stored ?? await this.store.createIfAbsent(
      id, normalizeRoomState(clientState)
    );
    this.records.set(id, record);
    return structuredClone(record);
  }

  update(roomId, updateState) {
    const id = normalizeRoomId(roomId);
    const previous = this.pending.get(id) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const current = await this.getOrCreate(id);
      const nextState = normalizeRoomState(updateState(structuredClone(current.state)));
      const saved = await this.store.save(id, nextState, current.version);
      this.records.set(id, saved);
      return structuredClone(saved);
    });
    this.pending.set(id, operation);
    const cleanup = () => {
      if (this.pending.get(id) === operation) this.pending.delete(id);
    };
    void operation.then(cleanup, cleanup);
    return operation;
  }
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- test/roomStateService.test.js`

Expected: 4 tests pass.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit Task 3**

```powershell
git add server/roomStateService.js test/roomStateService.test.js
git commit --only -m "feat: serialize authoritative room updates" -- server/roomStateService.js test/roomStateService.test.js
```

---

### Task 4: WebSocket Server Uses Persisted Full-State Commits

**Files:**
- Create: `server/createAppServer.js`
- Modify: `server/index.js`
- Create: `test/appServer.test.js`

**Interfaces:**
- Consumes: `RoomStateService`, RoomStore, Express, and `ws`.
- Produces: `createAppServer({ store, distDir, logger })` returning `{ app, server, close }`.
- WebSocket success protocol: `INIT_STATE` and `STATE_UPDATED` contain `{ tripTitle, members, expenses, version, updatedAt }` in `data`.
- WebSocket failure protocol: `{ type: 'SYNC_ERROR', message: '資料暫時無法儲存，請保留此頁並稍後重試。' }`.

- [ ] **Step 1: Write failing end-to-end WebSocket tests**

Create `test/appServer.test.js` using a real HTTP server on port `0`, a real `ws` client, and `FileRoomStore` backed by a temporary directory. Add helpers `waitForMessage(ws, type)` and `openClient(url)` that reject on timeout or socket error.

Test 1 must:

1. Start server A with a temporary `dataDir`.
2. Join `RESTART-TEST` with client data.
3. Send `ADD_EXPENSE` for `{ id: 'e1', title: '新幹線' }`.
4. Wait for `STATE_UPDATED` and assert version `2`.
5. Close server A.
6. Start server B using the same `dataDir`.
7. Join from a second client carrying a different stale cache.
8. Assert `INIT_STATE.data.expenses[0].title === '新幹線'` and version `2`.

Test 2 must use a store whose `save()` throws and assert the sender receives `SYNC_ERROR` while no `STATE_UPDATED` arrives.

- [ ] **Step 2: Run the integration tests and verify RED**

Run: `npm test -- test/appServer.test.js`

Expected: FAIL because `server/createAppServer.js` does not exist.

- [ ] **Step 3: Extract and implement the app server**

Move Express/static-file setup and WebSocket handling from `server/index.js` into `createAppServer.js`. For every mutation type, calculate the next full state through `RoomStateService.update()`:

```js
const mutations = {
  SYNC_DATA: (state, data) => ({ ...state, ...data }),
  ADD_EXPENSE: (state, data) => ({
    ...state,
    expenses: [data.expense, ...state.expenses.filter((item) => item.id !== data.expense.id)]
  }),
  UPDATE_EXPENSE: (state, data) => ({
    ...state,
    expenses: state.expenses.map((item) => item.id === data.expense.id ? data.expense : item)
  }),
  DELETE_EXPENSE: (state, data) => ({
    ...state,
    expenses: state.expenses.filter((item) => item.id !== data.id)
  }),
  UPDATE_MEMBERS: (state, data) => ({ ...state, members: data.members })
};
```

Convert a RoomStore record for the wire with:

```js
function recordData(record) {
  return {
    ...record.state,
    version: record.version,
    updatedAt: record.updatedAt
  };
}
```

For `JOIN_ROOM`, call `getOrCreate(roomId, msg.clientData)` and never compare client timestamps. For a mutation, await `service.update()`, then broadcast one `STATE_UPDATED` full-state message to every open client in that room, including the sender. Catch persistence errors, log them without credentials, and send only `SYNC_ERROR` to the sender.

The `/api/health` body must be:

```js
{
  status: 'ok',
  storage: store.kind,
  time: new Date().toISOString()
}
```

`close()` closes WebSocket clients, the HTTP server, and the store so tests do not leak handles.

- [ ] **Step 4: Replace `server/index.js` with async bootstrap code**

Use `DATA_DIR` when provided and fail startup if `store.init()` fails:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './createAppServer.js';
import { createRoomStore } from './storage/createRoomStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;
const store = createRoomStore({
  databaseUrl: process.env.DATABASE_URL,
  dataDir: process.env.DATA_DIR || path.join(__dirname, 'data')
});

try {
  await store.init();
  const { server } = createAppServer({
    store,
    distDir: path.join(__dirname, '..', 'dist'),
    logger: console
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Japan Trip server listening on ${port} with ${store.kind} storage`);
  });
} catch (error) {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
}
```

- [ ] **Step 5: Run integration and full tests**

Run: `npm test -- test/appServer.test.js`

Expected: restart and storage-failure tests pass with no open-handle warning.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit Task 4**

```powershell
git add server/createAppServer.js server/index.js test/appServer.test.js
git commit --only -m "feat: persist WebSocket room updates" -- server/createAppServer.js server/index.js test/appServer.test.js
```

Because `server/index.js` already has uncommitted changes, review `git diff -- server/index.js` before staging and verify the final code intentionally replaces the client-timestamp recovery logic with database authority.

---

### Task 5: Frontend Applies Server Versions and Reports Sync Failures

**Files:**
- Create: `src/utils/roomCache.js`
- Create: `test/roomCache.test.js`
- Modify: `src/utils/realtimeSync.js`
- Modify: `src/App.jsx`
- Modify: `src/components/Header.jsx`

**Interfaces:**
- Produces: `roomStorageKey(roomId, field)`, `loadCachedRoom(roomId, defaults)`, `saveServerRoom(roomId, data)`, and `shouldApplyServerVersion(localVersion, serverVersion)`.
- `RealtimeSyncManager` emits `sync_error` for `SYNC_ERROR` messages.
- `Header` accepts `syncError` and exposes it through the room button title and an error badge.

- [ ] **Step 1: Write failing cache-authority tests**

Create `test/roomCache.test.js` using a small in-memory object implementing `getItem` and `setItem`:

```js
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
```

- [ ] **Step 2: Run the cache tests and verify RED**

Run: `npm test -- test/roomCache.test.js`

Expected: FAIL with missing `src/utils/roomCache.js`.

- [ ] **Step 3: Implement room-scoped cache helpers**

Move the parsing and room-scoped key logic currently embedded in `App.jsx` into `src/utils/roomCache.js`. Use `version`, not browser `updatedAt`, for server-event ordering. `saveServerRoom()` writes title, members, expenses, and version together; it must accept empty arrays so deleting the last record is preserved.

The exported ordering helper is exactly:

```js
export function shouldApplyServerVersion(localVersion, serverVersion) {
  return Number(serverVersion) >= Number(localVersion || 0);
}
```

- [ ] **Step 4: Update the WebSocket client protocol**

In `src/utils/realtimeSync.js`:

- Retain client data on `JOIN_ROOM`, because it may seed a genuinely absent database room.
- Stop treating client `updatedAt` as authoritative.
- Keep `STATE_UPDATED` as the single committed-state event.
- Add:

```js
case 'SYNC_ERROR':
  this.emit('sync_error', msg.message || '資料同步失敗，請稍後重試。');
  break;
```

The existing operation methods may continue sending their payloads, but remove browser-generated `updatedAt` arguments from the protocol.

- [ ] **Step 5: Update `App.jsx` to adopt authoritative full states**

Replace local `lastUpdatedAt` with `serverVersion`. On `INIT_STATE`, always call one `applyServerData(serverData)` helper that sets title, members, expenses, version, and the room cache, including empty arrays. On `STATE_UPDATED`, call it only when `shouldApplyServerVersion(serverVersion, serverData.version)` is true.

All optimistic user actions may continue updating the visible React state and room cache immediately. Do not increment `serverVersion`; it advances only when `STATE_UPDATED` arrives. Add a `syncError` state, clear it on `INIT_STATE` or `STATE_UPDATED`, and subscribe to `sync_error` to set the message.

Remove the `init_state` branch that broadcasts local data when a browser timestamp is newer than the server. The server alone decides whether client cache may seed an absent room.

- [ ] **Step 6: Display a concise error state in `Header.jsx`**

Pass `syncError` from `App.jsx`. When it is present, the room button dot remains rose-colored, its `title` equals the error message, and the visible compact label changes from the online count to `未儲存`. Do not show database details or credentials.

- [ ] **Step 7: Run focused tests and build**

Run: `npm test -- test/roomCache.test.js`

Expected: 2 tests pass.

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: Vite production build succeeds without unresolved imports.

- [ ] **Step 8: Commit Task 5**

```powershell
git add src/utils/roomCache.js test/roomCache.test.js src/utils/realtimeSync.js src/App.jsx src/components/Header.jsx
git commit --only -m "fix: make server room versions authoritative" -- src/utils/roomCache.js test/roomCache.test.js src/utils/realtimeSync.js src/App.jsx src/components/Header.jsx
```

Review the existing uncommitted changes in `App.jsx` and `realtimeSync.js` before staging; preserve room-scoped cache migration and remove only the unsafe client-timestamp authority behavior.

---

### Task 6: Deployment Configuration, Data Hygiene, and Documentation

**Files:**
- Modify: `.gitignore`
- Delete: `server/data/TEST-SYNC.json`
- Delete: `server/data/TOKYO-2026.json`
- Delete: `server/data/__.json`
- Retain: `server/data/.gitkeep`
- Modify: `render.yaml`
- Modify: `DEPLOY_GUIDE.md`

**Interfaces:**
- Consumes: `DATABASE_URL` startup behavior and `/api/health` from Task 4.
- Produces: a Render blueprint declaration for a secret `DATABASE_URL` and a user-facing Neon setup checklist.

- [ ] **Step 1: Write a failing configuration assertion**

Create a temporary verification command; do not add another parser dependency:

```powershell
node -e "const fs=require('fs'); const y=fs.readFileSync('render.yaml','utf8'); if(!/key:\s*DATABASE_URL[\s\S]*sync:\s*false/.test(y)) process.exit(1)"
```

Run it before editing.

Expected: exit code 1 because `DATABASE_URL` is not declared.

- [ ] **Step 2: Mark `DATABASE_URL` as a manually supplied Render secret**

Append this entry under the existing `envVars` in `render.yaml`:

```yaml
      - key: DATABASE_URL
        sync: false
```

Do not place a Neon URL in `render.yaml`.

- [ ] **Step 3: Finalize runtime-data hygiene**

Ensure `.gitignore` contains:

```gitignore
# Server runtime room data (local fallback only)
server/data/*.json
!server/data/.gitkeep
```

Keep the already-staged deletions of `TEST-SYNC.json`, `TOKYO-2026.json`, and `__.json`; retain `.gitkeep`. Verify with:

```powershell
git ls-files server/data
```

Expected after commit: only `server/data/.gitkeep`.

- [ ] **Step 4: Replace inaccurate deployment claims with Neon steps**

Update `DEPLOY_GUIDE.md` so the Render section states that the web service filesystem is not the production data store. Include exactly these operational steps:

1. Create a Neon PostgreSQL project.
2. Copy its pooled PostgreSQL connection string containing `sslmode=require`.
3. In Render, open `japan-trip-split` → Environment → add secret `DATABASE_URL`.
4. Redeploy the current commit.
5. Open `/api/health` and require `"status":"ok"` plus `"storage":"postgresql"`.
6. Create a new test room, add one member and expense, redeploy, then verify the same room from another browser.

State that current provider prices and free quotas must be checked in each provider's dashboard; do not promise “24/7 permanently free.”

- [ ] **Step 5: Re-run configuration, secret, and full verification**

Run:

```powershell
node -e "const fs=require('fs'); const y=fs.readFileSync('render.yaml','utf8'); if(!/key:\s*DATABASE_URL[\s\S]*sync:\s*false/.test(y)) process.exit(1)"
rg -n "postgres(ql)?://|DATABASE_URL=" . -g '!node_modules/**' -g '!docs/superpowers/**'
npm test
npm run build
```

Expected:

- configuration assertion exits 0;
- secret scan finds no committed connection string or assigned `DATABASE_URL`;
- all tests pass;
- production build succeeds.

- [ ] **Step 6: Commit Task 6**

```powershell
git add .gitignore render.yaml DEPLOY_GUIDE.md server/data/.gitkeep
git add -u server/data
git commit -m "docs: configure durable Neon deployment"
```

Before committing, verify the staged list contains only Task 6 paths.

---

### Task 7: Final Regression and Local Restart Verification

**Files:**
- Modify only if a verification failure reveals a defect covered by this spec.

**Interfaces:**
- Verifies all interfaces produced by Tasks 1–6.

- [ ] **Step 1: Run clean automated verification**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected: all tests pass, Vite build succeeds, and `git diff --check` prints nothing.

- [ ] **Step 2: Verify the local JSON fallback across a real process restart**

Start the server without `DATABASE_URL` on an unused port, connect with a WebSocket client, create a uniquely named room and expense, stop the process, restart it with the same `DATA_DIR`, and join again. Assert the returned title, member IDs, expense IDs, and version are identical to the committed state.

Use a `mktemp`/temporary directory outside `server/data` so verification does not create workspace room files. Stop both server processes and remove only that verified temporary directory afterward.

- [ ] **Step 3: Inspect the final change boundary**

Run:

```powershell
git status --short
git log --oneline --decorate -8
git diff HEAD~6..HEAD --stat
```

Confirm no connection string, unrelated user file, generated `dist`, or runtime JSON is committed.

- [ ] **Step 4: Prepare deployment handoff**

Report:

- the exact commits created;
- the exact Render environment variable name: `DATABASE_URL`;
- the health endpoint expected value: `storage: postgresql`;
- that live persistence remains unverified until a real Neon connection string is configured and a restart test is performed on Render.

Do not claim the production bug fixed until the deployed cross-browser restart verification passes.
