import { FileRoomStore } from './fileRoomStore.js';
import { PostgresRoomStore } from './postgresRoomStore.js';

export function createRoomStore({ databaseUrl, dataDir, pool } = {}) {
  if (databaseUrl) return new PostgresRoomStore({ databaseUrl, pool });
  return new FileRoomStore({ dataDir });
}
