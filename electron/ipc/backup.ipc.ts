/**
 * ATM - 备份与恢复 IPC 处理器（V5.7）
 *
 * 通道：
 *  - backup:create    创建 .atmbak 备份文件（弹出保存对话框）
 *  - backup:open      选择 .atmbak 备份文件（弹出打开对话框）
 *  - backup:inspect   读取并解析备份，返回摘要供预览
 *  - backup:restore   将备份恢复到当前激活的 pcbenv
 */
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  createBackupFile,
  parseBackupFile,
  restoreBackupFile,
  serializeBackupFile,
  summarizeBackup,
} from '../../core/backup/backupManager';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { applySavedWindowState } from '../windowState';
import type { BackupRestoreOptions } from '../../src/types/backup';

const BACKUP_EXT = 'atmbak';

function getUpdateSettingsPath(): string {
  return path.join(app.getPath('userData'), 'update-settings.json');
}

function readUpdateSettings(): Record<string, unknown> | undefined {
  try {
    const filePath = getUpdateSettingsPath();
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function registerBackupIpc(): void {
  /** 创建备份文件（内容由渲染进程传入界面偏好） */
  ipcMain.handle('backup:create', async (_event, uiPrefsJson?: string, appVersion?: string) => {
    try {
      let uiPreferences: Record<string, string> | undefined;
      if (uiPrefsJson) {
        uiPreferences = JSON.parse(uiPrefsJson);
      }

      const envInfo = locateEnvironment();
      const backup = createBackupFile(envInfo.pcbenvPath || '', {
        appVersion: appVersion || 'unknown',
        uiPreferences,
        updateSettings: readUpdateSettings(),
      });
      const content = serializeBackupFile(backup);

      const defaultName = `atm-backup-${new Date().toISOString().slice(0, 10)}.${BACKUP_EXT}`;
      const result = await dialog.showSaveDialog({
        title: '保存 ATM 设置备份',
        defaultPath: defaultName,
        filters: [{ name: 'ATM 备份文件', extensions: [BACKUP_EXT] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: true, data: null, info: '取消保存' };
      }

      fs.writeFileSync(result.filePath, content, 'utf-8');
      return {
        success: true,
        data: { filePath: result.filePath, summary: summarizeBackup(backup) },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `创建备份失败: ${message}` };
    }
  });

  /** 选择备份文件 */
  ipcMain.handle('backup:open', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择 ATM 备份文件',
        properties: ['openFile'],
        filters: [
          { name: 'ATM 备份文件', extensions: [BACKUP_EXT] },
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null, info: '取消选择' };
      }
      const filePath = result.filePaths[0];
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }
      return { success: true, data: filePath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `打开备份文件失败: ${message}` };
    }
  });

  /** 解析备份并返回摘要 */
  ipcMain.handle('backup:inspect', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '备份文件不存在' };
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const backup = parseBackupFile(content);
      return {
        success: true,
        data: {
          summary: summarizeBackup(backup),
          source: backup.source,
          createdAt: backup.createdAt,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  /** 恢复到当前激活 pcbenv */
  ipcMain.handle('backup:restore', async (event, filePath: string, optionsJson?: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '备份文件不存在' };
      }
      const options: BackupRestoreOptions = optionsJson ? JSON.parse(optionsJson) : {};
      const content = fs.readFileSync(filePath, 'utf-8');
      const backup = parseBackupFile(content);
      const envInfo = locateEnvironment();
      if (!envInfo.pcbenvPath) {
        return { success: false, error: '未找到可恢复的 pcbenv 目录，请先在环境页完成配置。' };
      }
      const result = restoreBackupFile(envInfo.pcbenvPath, backup, {
        ...options,
        appPaths: { updateSettingsPath: getUpdateSettingsPath() },
      });

      // 若备份包含窗口状态，立即应用到当前窗口（新电脑 / 新板子无需重启即可看到布局还原）
      if (backup.sections.app?.windowState) {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (senderWindow) {
          applySavedWindowState(senderWindow);
        }
      }

      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `恢复备份失败: ${message}` };
    }
  });
}
