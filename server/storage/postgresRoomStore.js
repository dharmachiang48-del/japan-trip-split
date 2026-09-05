import pg from 'pg';
import { VersionConflictError } from './roomStoreErrors.js';

function toRecord(row) {
  if (!row) return null;
  return {
    roomId: row.room_id,
    state: row.state,
    version: Number(row.version),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

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
