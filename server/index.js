// 多人即時同步 WebSocket 伺服器 (Real-time Collaboration Server)
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

// 確保資料儲存目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());

// 提供伺服器健康狀態檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 儲存各個房間的連線與狀態: Map<roomId, { clients: Set<WebSocket>, data: Object }>
const rooms = new Map();

function getRoomDataPath(roomId) {
  // 安全過濾檔名
  const safeId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeId}.json`);
}

function loadRoomData(roomId) {
  const filePath = getRoomDataPath(roomId);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`Error loading room ${roomId}:`, e);
    }
  }
  return null;
}

function saveRoomData(roomId, data) {
  const filePath = getRoomDataPath(roomId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error saving room ${roomId}:`, e);
  }
}

function broadcastToRoom(roomId, message, senderWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(message);
  room.clients.forEach(client => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  let currentRoomId = null;
  let clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw);
      const { type, roomId, data } = msg;

      if (type === 'JOIN_ROOM') {
        currentRoomId = roomId || 'TOKYO-2026';

        if (!rooms.has(currentRoomId)) {
          // 嘗試自硬碟讀取舊紀錄
          const savedData = loadRoomData(currentRoomId) || {
            tripTitle: '2026 日本東京自由行 🎌',
            members: [],
            expenses: []
          };
          rooms.set(currentRoomId, {
            clients: new Set(),
            data: savedData
          });
        }

        const room = rooms.get(currentRoomId);
        room.clients.add(ws);

        console.log(`[WS] Client ${clientId} joined room "${currentRoomId}". Online: ${room.clients.size}`);

        // 回傳該房間的當前最新完整資料與在線人數
        ws.send(JSON.stringify({
          type: 'INIT_STATE',
          roomId: currentRoomId,
          data: room.data,
          onlineCount: room.clients.size
        }));

        // 廣播給同房間其他人更新在線人數
        broadcastToRoom(currentRoomId, {
          type: 'ONLINE_COUNT_CHANGED',
          onlineCount: room.clients.size
        }, ws);
      }

      else if (type === 'SYNC_DATA') {
        // 客戶端傳送整體資料更新 (expenses, members, tripTitle)
        if (!currentRoomId || !rooms.has(currentRoomId)) return;
        const room = rooms.get(currentRoomId);

        room.data = {
          ...room.data,
          ...data,
          lastUpdated: new Date().toISOString()
        };

        saveRoomData(currentRoomId, room.data);

        // 廣播給房間內其他旅伴
        broadcastToRoom(currentRoomId, {
          type: 'STATE_UPDATED',
          data: room.data,
          fromClient: clientId
        }, ws);
      }

      else if (type === 'ADD_EXPENSE') {
        if (!currentRoomId || !rooms.has(currentRoomId)) return;
        const room = rooms.get(currentRoomId);

        const newExp = data.expense;
        room.data.expenses = [newExp, ...(room.data.expenses || [])];
        saveRoomData(currentRoomId, room.data);

        broadcastToRoom(currentRoomId, {
          type: 'EXPENSE_ADDED',
          expense: newExp,
          fromClient: clientId
        }, ws);
      }

      else if (type === 'UPDATE_EXPENSE') {
        if (!currentRoomId || !rooms.has(currentRoomId)) return;
        const room = rooms.get(currentRoomId);

        const updated = data.expense;
        room.data.expenses = (room.data.expenses || []).map(e => e.id === updated.id ? updated : e);
        saveRoomData(currentRoomId, room.data);

        broadcastToRoom(currentRoomId, {
          type: 'EXPENSE_UPDATED',
          expense: updated,
          fromClient: clientId
        }, ws);
      }

      else if (type === 'DELETE_EXPENSE') {
        if (!currentRoomId || !rooms.has(currentRoomId)) return;
        const room = rooms.get(currentRoomId);

        const expId = data.id;
        room.data.expenses = (room.data.expenses || []).filter(e => e.id !== expId);
        saveRoomData(currentRoomId, room.data);

        broadcastToRoom(currentRoomId, {
          type: 'EXPENSE_DELETED',
          id: expId,
          fromClient: clientId
        }, ws);
      }

      else if (type === 'UPDATE_MEMBERS') {
        if (!currentRoomId || !rooms.has(currentRoomId)) return;
        const room = rooms.get(currentRoomId);

        room.data.members = data.members;
        saveRoomData(currentRoomId, room.data);

        broadcastToRoom(currentRoomId, {
          type: 'MEMBERS_UPDATED',
          members: data.members,
          fromClient: clientId
        }, ws);
      }

      else if (type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }

    } catch (err) {
      console.error('[WS] Message handling error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      room.clients.delete(ws);
      console.log(`[WS] Client ${clientId} disconnected from "${currentRoomId}". Online: ${room.clients.size}`);

      if (room.clients.size === 0) {
        // 所有人都離線，資料已保存至硬碟
      } else {
        broadcastToRoom(currentRoomId, {
          type: 'ONLINE_COUNT_CHANGED',
          onlineCount: room.clients.size
        });
      }
    }
  });
});

// 生產環境：託管前端 Vite 打包後的靜態資源
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  console.log(`📦 Serving production static assets from: ${DIST_DIR}`);
  app.use(express.static(DIST_DIR));
  // Express 5 兼容的 SPA fallback (任何未匹配路由均回傳 index.html)
  app.use((req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Japan Trip Realtime Sync Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for multi-user collaboration`);
});
