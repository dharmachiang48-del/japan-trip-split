import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createAppServer } from '../server/createAppServer.js';
import { FileRoomStore } from '../server/storage/fileRoomStore.js';

const silentLogger = {
  log() {},
  warn() {},
  error() {}
};

function waitForMessage(ws, type, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeoutMs);

    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type !== type) return;
      cleanup();
      resolve(message);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('message', onMessage);
      ws.off('error', onError);
    };

    ws.on('message', onMessage);
    ws.on('error', onError);
  });
}

function openClient(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

async function startServer(store) {
  await store.init();
  const instance = createAppServer({
    store,
    distDir: path.join(tmpdir(), 'missing-trip-dist'),
    logger: silentLogger
  });
  await new Promise((resolve, reject) => {
    instance.server.once('error', reject);
    instance.server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = instance.server.address();
  return { ...instance, url: `ws://127.0.0.1:${port}` };
}

test('committed room state survives a server restart and stale client cache', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'trip-app-server-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));

  const firstServer = await startServer(new FileRoomStore({ dataDir }));
  const firstClient = await openClient(firstServer.url);
  const firstInit = waitForMessage(firstClient, 'INIT_STATE');
  firstClient.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId: 'RESTART-TEST',
    clientData: { tripTitle: '東京行', members: [], expenses: [] }
  }));
  assert.equal((await firstInit).data.version, 1);

  const committedMessage = waitForMessage(firstClient, 'STATE_UPDATED');
  firstClient.send(JSON.stringify({
    type: 'ADD_EXPENSE',
    roomId: 'RESTART-TEST',
    data: { expense: { id: 'e1', title: '新幹線' } }
  }));
  const committed = await committedMessage;
  assert.equal(committed.data.version, 2);
  assert.equal(committed.data.expenses[0].title, '新幹線');
  await firstServer.close();

  const secondServer = await startServer(new FileRoomStore({ dataDir }));
  t.after(() => secondServer.close());
  const secondClient = await openClient(secondServer.url);
  const restartedInit = waitForMessage(secondClient, 'INIT_STATE');
  secondClient.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId: 'RESTART-TEST',
    clientData: { tripTitle: '舊快取', members: [], expenses: [] }
  }));
  const restored = await restartedInit;
  assert.equal(restored.data.version, 2);
  assert.equal(restored.data.tripTitle, '東京行');
  assert.equal(restored.data.expenses[0].title, '新幹線');
});

test('a persistence failure returns SYNC_ERROR without broadcasting success', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'trip-app-server-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  class FailingSaveStore extends FileRoomStore {
    async save() {
      throw new Error('database unavailable');
    }
  }

  const instance = await startServer(new FailingSaveStore({ dataDir }));
  t.after(() => instance.close());
  const client = await openClient(instance.url);
  const init = waitForMessage(client, 'INIT_STATE');
  client.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId: 'FAILURE-TEST',
    clientData: { tripTitle: '東京行', members: [], expenses: [] }
  }));
  await init;

  const receivedTypes = [];
  client.on('message', (raw) => receivedTypes.push(JSON.parse(raw.toString()).type));
  const errorMessage = waitForMessage(client, 'SYNC_ERROR');
  client.send(JSON.stringify({
    type: 'ADD_EXPENSE',
    roomId: 'FAILURE-TEST',
    data: { expense: { id: 'e1', title: '車票' } }
  }));
  const result = await errorMessage;
  assert.match(result.message, /無法儲存/);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(receivedTypes.includes('STATE_UPDATED'), false);
});
