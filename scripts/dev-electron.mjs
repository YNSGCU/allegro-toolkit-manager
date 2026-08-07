// @ts-check
// 开发模式：等待 Vite 就绪后启动 Electron
import { spawn } from 'child_process';
import { createServer } from 'net';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const VITE_PORT = 5173;
const ELECTRON_PATH = require.resolve('electron');

async function waitForVite(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const socket = createServer();
        socket.on('error', reject);
        socket.on('listening', () => {
          socket.close();
          resolve();
        });
        socket.listen(port, '127.0.0.1');
      });
      // Port is free — Vite not ready yet
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      // Port in use — Vite is running
      return;
    }
  }
  throw new Error(`Vite did not start on port ${port} within ${timeoutMs}ms`);
}

async function main() {
  console.log('[dev] Waiting for Vite dev server...');
  await waitForVite(VITE_PORT);

  console.log('[dev] Starting Electron...');
  const electron = spawn(ELECTRON_PATH, ['dist-electron/electron/main.js'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${VITE_PORT}` },
  });

  electron.on('close', (code) => {
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    electron.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
