/**
 * ATM - Allegro 会话控制台 IPC 处理器
 */
import { ipcMain } from 'electron';
import { probeSession } from '../../core/session/sessionProbe';
import {
  classifyCommandRisk,
  executeSessionCommand,
} from '../../core/session/sessionCommand';
import {
  loadSessionCommands,
  recordSessionCommand,
  saveSessionCommands,
  toggleSessionFavorite,
} from '../../core/session/sessionCommandStore';

export function registerSessionIpc(): void {
  ipcMain.handle('session:probe', async () => {
    try {
      const snapshot = await probeSession();
      return { success: true, data: snapshot };
    } catch (err) {
      return { success: false, error: `探测会话失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('session:command', async (_event, code: string) => {
    try {
      if (typeof code !== 'string') return { success: false, error: '命令必须是字符串。' };
      const risk = classifyCommandRisk(code);
      const result = await executeSessionCommand(code);
      // 记录命令历史（失败不影响执行结果）
      try {
        const store = loadSessionCommands();
        saveSessionCommands(recordSessionCommand(store, code.trim(), risk, result.success));
      } catch {
        // 忽略历史记录失败
      }
      return { success: result.success, data: { ...result, risk } };
    } catch (err) {
      return { success: false, error: `执行命令失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('session:history-load', () => {
    try {
      return { success: true, data: loadSessionCommands() };
    } catch (err) {
      return { success: false, error: '加载命令历史失败: ' + (err instanceof Error ? err.message : String(err)) };
    }
  });

  ipcMain.handle('session:favorite-toggle', (_event, code: string) => {
    try {
      if (typeof code !== 'string') return { success: false, error: '命令无效。' };
      const store = toggleSessionFavorite(loadSessionCommands(), code);
      saveSessionCommands(store);
      return { success: true, data: store };
    } catch (err) {
      return { success: false, error: '切换收藏失败: ' + (err instanceof Error ? err.message : String(err)) };
    }
  });

  ipcMain.handle('session:history-clear', () => {
    try {
      saveSessionCommands({ version: 1, items: [] });
      return { success: true, data: { version: 1, items: [] } };
    } catch (err) {
      return { success: false, error: '清空历史失败: ' + (err instanceof Error ? err.message : String(err)) };
    }
  });
}
