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
        encoding: 'utf8',
        flag: 'wx'
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
