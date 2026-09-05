// 前端即時同步客戶端 (Realtime WebSocket Client Manager)

class RealtimeSyncManager {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.status = 'disconnected'; // 'connected', 'connecting', 'disconnected'
    this.onlineCount = 1;
  }

  // 註冊事件監聽
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  // 連線並加入指定房間
  connect(roomId = 'TOKYO-2026') {
    this.roomId = roomId;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'JOIN_ROOM', roomId: this.roomId });
      }
      return;
    }

    this.setStatus('connecting');

    // 動態偵測伺服器網址：統一透過 Port 3000 的 /ws 代理連線
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[Sync] Connected to WebSocket at ${wsUrl}`);
        this.setStatus('connected');
        this.send({ type: 'JOIN_ROOM', roomId: this.roomId });
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[Sync] Error parsing message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[Sync] WebSocket connection closed, will retry...');
        this.setStatus('disconnected');
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[Sync] WebSocket connection failed:', err);
        this.setStatus('disconnected');
      };
    } catch (e) {
      console.error('[Sync] Init failed:', e);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING' });
      }
    }, 15000);
  }

  stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.roomId) {
        this.connect(this.roomId);
      }
    }, 3000);
  }

  setStatus(status) {
    this.status = status;
    this.emit('status_change', { status, onlineCount: this.onlineCount });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...data, roomId: this.roomId }));
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'INIT_STATE':
        this.onlineCount = msg.onlineCount || 1;
        this.emit('init_state', msg.data);
        this.emit('online_count', this.onlineCount);
        break;

      case 'ONLINE_COUNT_CHANGED':
        this.onlineCount = msg.onlineCount || 1;
        this.emit('online_count', this.onlineCount);
        break;

      case 'STATE_UPDATED':
        this.emit('state_updated', msg.data);
        break;

      case 'EXPENSE_ADDED':
        this.emit('expense_added', msg.expense);
        break;

      case 'EXPENSE_UPDATED':
        this.emit('expense_updated', msg.expense);
        break;

      case 'EXPENSE_DELETED':
        this.emit('expense_deleted', msg.id);
        break;

      case 'MEMBERS_UPDATED':
        this.emit('members_updated', msg.members);
        break;

      case 'PONG':
        break;

      default:
        break;
    }
  }

  // 廣播操作給所有同房間使用者
  broadcastExpenseAdded(expense) {
    this.send({ type: 'ADD_EXPENSE', data: { expense } });
  }

  broadcastExpenseUpdated(expense) {
    this.send({ type: 'UPDATE_EXPENSE', data: { expense } });
  }

  broadcastExpenseDeleted(id) {
    this.send({ type: 'DELETE_EXPENSE', data: { id } });
  }

  broadcastMembersUpdated(members) {
    this.send({ type: 'UPDATE_MEMBERS', data: { members } });
  }

  broadcastFullState(data) {
    this.send({ type: 'SYNC_DATA', data });
  }
}

export const realtimeSync = new RealtimeSyncManager();
