export const DEFAULT_TRIP_TITLE = '2026 日本沖繩自由行 🌺';

export function normalizeRoomId(value) {
  return String(value || 'TOKYO-2026').trim().toUpperCase() || 'TOKYO-2026';
}

export function normalizeRoomState(value) {
  return {
    tripTitle: typeof value?.tripTitle === 'string' && value.tripTitle.trim()
      ? value.tripTitle
      : DEFAULT_TRIP_TITLE,
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
      id,
      normalizeRoomState(clientState)
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
