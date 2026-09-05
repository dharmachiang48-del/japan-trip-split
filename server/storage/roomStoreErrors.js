export class VersionConflictError extends Error {
  constructor(roomId) {
    super(`Room version conflict: ${roomId}`);
    this.name = 'VersionConflictError';
  }
}
