import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomStateService, normalizeRoomId } from './roomStateService.js';

const SYNC_ERROR_MESSAGE = '資料暫時無法儲存，請保留此頁並稍後重試。';

const mutations = {
  SYNC_DATA: (state, data) => ({ ...state, ...data }),
  ADD_EXPENSE: (state, data) => ({
    ...state,
    expenses: [
      data.expense,
      ...state.expenses.filter((item) => item.id !== data.expense.id)
    ]
  }),
  UPDATE_EXPENSE: (state, data) => ({
    ...state,
    expenses: state.expenses.map((item) => (
      item.id === data.expense.id ? data.expense : item
    ))
  }),
  DELETE_EXPENSE: (state, data) => ({
    ...state,
    expenses: state.expenses.filter((item) => item.id !== data.id)
  }),
  UPDATE_MEMBERS: (state, data) => ({ ...state, members: data.members })
};

function recordData(record) {
  return {
    ...record.state,
    version: record.version,
    updatedAt: record.updatedAt
  };
}

export function createAppServer({ store, distDir, logger = console }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      storage: store.kind,
      time: new Date().toISOString()
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const roomState = new RoomStateService({ store });
  const roomClients = new Map();

  function send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function broadcast(roomId, message, except = null) {
    for (const client of roomClients.get(roomId) ?? []) {
      if (client !== except) send(client, message);
    }
  }

  function removeClient(roomId, ws) {
    if (!roomId) return;
    const clients = roomClients.get(roomId);
    if (!clients) return;
    clients.delete(ws);
    if (clients.size === 0) roomClients.delete(roomId);
    else {
      broadcast(roomId, {
        type: 'ONLINE_COUNT_CHANGED',
        onlineCount: clients.size
      });
    }
  }

  wss.on('connection', (ws) => {
    let currentRoomId = null;
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    ws.on('message', async (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === 'PING') {
          send(ws, { type: 'PONG' });
          return;
        }

        if (message.type === 'JOIN_ROOM') {
          const nextRoomId = normalizeRoomId(message.roomId);
          if (currentRoomId !== nextRoomId) {
            removeClient(currentRoomId, ws);
            currentRoomId = nextRoomId;
          }

          const record = await roomState.getOrCreate(currentRoomId, message.clientData);
          if (!roomClients.has(currentRoomId)) roomClients.set(currentRoomId, new Set());
          const clients = roomClients.get(currentRoomId);
          clients.add(ws);

          logger.log(`[WS] ${clientId} joined ${currentRoomId}; online=${clients.size}; version=${record.version}`);
          send(ws, {
            type: 'INIT_STATE',
            roomId: currentRoomId,
            data: recordData(record),
            onlineCount: clients.size
          });
          broadcast(currentRoomId, {
            type: 'ONLINE_COUNT_CHANGED',
            onlineCount: clients.size
          }, ws);
          return;
        }

        const updateState = mutations[message.type];
        if (!updateState || !currentRoomId) return;

        try {
          const record = await roomState.update(
            currentRoomId,
            (state) => updateState(state, message.data ?? {})
          );
          broadcast(currentRoomId, {
            type: 'STATE_UPDATED',
            data: recordData(record),
            fromClient: clientId
          });
        } catch (error) {
          logger.error(`[WS] Failed to persist ${message.type} for ${currentRoomId}:`, error);
          send(ws, { type: 'SYNC_ERROR', message: SYNC_ERROR_MESSAGE });
        }
      } catch (error) {
        logger.error('[WS] Message handling error:', error);
        send(ws, { type: 'SYNC_ERROR', message: SYNC_ERROR_MESSAGE });
      }
    });

    ws.on('close', () => {
      removeClient(currentRoomId, ws);
      logger.log(`[WS] ${clientId} disconnected from ${currentRoomId ?? 'no room'}`);
    });
  });

  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.use((req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else {
    logger.warn(`Static assets not found at ${distDir}`);
    app.use((req, res) => {
      res.status(200).send('<!doctype html><html><body><h1>Japan Trip Split</h1></body></html>');
    });
  }

  async function close() {
    for (const client of wss.clients) client.terminate();
    await new Promise((resolve) => wss.close(() => resolve()));
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await store.close();
  }

  return { app, server, close };
}
