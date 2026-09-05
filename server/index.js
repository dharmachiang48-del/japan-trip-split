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
