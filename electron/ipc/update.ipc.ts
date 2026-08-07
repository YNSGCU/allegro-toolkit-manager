import { BrowserWindow, ipcMain } from 'electron';
import type { UpdateService } from '../services/updateService';
import type { UpdateSettings } from '../../src/types/updates';

export function registerUpdateIpc(service: UpdateService): void {
  ipcMain.handle('app:update-state', () => service.state());
  ipcMain.handle('app:update-settings', () => service.settings());
  ipcMain.handle('app:update-settings-save', (_event, settings: UpdateSettings) => service.saveSettings(settings));
  ipcMain.handle('app:update-check', () => service.check());
  ipcMain.handle('app:update-download', () => service.download());
  ipcMain.handle('app:update-install', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow || senderWindow.isDestroyed()) throw new Error('更新请求来源无效');
    service.install();
  });
}
