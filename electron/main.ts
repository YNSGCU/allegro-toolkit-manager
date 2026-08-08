/**
 * ATM - Electron 主进程入口
 * 生产模式使用内嵌 HTTP 服务器提供前端资源（解决 file:// 下 ES module CORS 问题）
 *
 * 版本：V5.4 — 添加运行版本自检（app:getRuntimeInfo）
 * 如果修改此文件，必须重新构建：npm run build:electron
 * 然后重启 Electron 应用。
 */
import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { registerIpcHandlers } from './ipc/index';
import { initDebug } from '../core/debug';
import { ATM_WINDOW_BOUNDS } from './windowConfig';
import { resolveRendererRequest, shouldFallbackToIndexHtml } from './rendererAssetPath';
import { UpdateService } from './services/updateService';
import { getWindowInitialState, trackWindowState } from './windowState';


let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getMimeType(ext: string): string {
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/** 启动本地 HTTP 服务器提供 dist 目录 */
function startServer(distDir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      // URL → 文件路径映射
      const { requestPath, filePath } = resolveRendererRequest(distDir, req.url);
      const ext = path.extname(filePath).toLowerCase();

      fs.readFile(filePath, (err, data) => {
        if (err) {
          if (shouldFallbackToIndexHtml(requestPath)) {
            const fallbackPath = path.join(distDir, 'index.html');
            fs.readFile(fallbackPath, (fallbackErr, fallbackData) => {
              if (fallbackErr) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found: ' + requestPath);
                return;
              }

              res.writeHead(200, {
                'Content-Type': getMimeType('.html'),
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
              });
              res.end(fallbackData);
            });
            return;
          }

          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found: ' + requestPath);
          return;
        }
        res.writeHead(200, {
          'Content-Type': getMimeType(ext),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      });
    });

    server.on('error', reject);
    // 使用随机可用端口
    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') {
        resolve(addr.port);
      } else {
        reject(new Error('Failed to get server port'));
      }
    });
  });
}

async function createWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, 'preload.js');
  const initialState = getWindowInitialState();
  const bounds = initialState?.bounds;

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? ATM_WINDOW_BOUNDS.width,
    height: bounds?.height ?? ATM_WINDOW_BOUNDS.height,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: ATM_WINDOW_BOUNDS.minWidth,
    minHeight: ATM_WINDOW_BOUNDS.minHeight,
    title: 'ATM - Allegro Toolkit Manager',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (initialState?.isMaximized) {
    mainWindow.maximize();
  }
  trackWindowState(mainWindow);

  console.log('[ATM] Preload path:', preloadPath);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：启动本地 HTTP 服务器
    // __dirname = dist-electron/electron/ → 上两层到项目根 → dist/
    const distDir = path.join(__dirname, '../../dist');
    const port = await startServer(distDir);
    const appUrl = `http://127.0.0.1:${port}/index.html`;
    console.log('[ATM] Production server started at', appUrl);
    mainWindow.loadURL(appUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // 初始化调试日志控制（环境变量 ATM_DEBUG=true）
  initDebug();

  let defaultFeedUrl = '';
  try {
    const packageMetadata = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
    if (typeof packageMetadata.atmUpdateFeedUrl === 'string') defaultFeedUrl = packageMetadata.atmUpdateFeedUrl;
  } catch {
    // 本地开发或旧安装包没有内置更新源。
  }
  const updateService = new UpdateService(
    autoUpdater,
    app.getVersion(),
    app.isPackaged,
    app.getPath('userData'),
    (state) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('app:update-state-changed', state);
      }
    },
    defaultFeedUrl,
  );

  registerIpcHandlers(updateService);
  await updateService.configure();
  await createWindow();

  if (updateService.state().status === 'idle') {
    setTimeout(() => void updateService.check(), 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (server) {
    server.close();
    server = null;
  }
});
