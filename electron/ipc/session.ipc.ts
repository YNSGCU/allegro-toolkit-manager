/**
 * ATM - Allegro 会话控制台 IPC 处理器
 */
import { ipcMain } from 'electron';
import { probeSession } from '../../core/session/sessionProbe';
import {
  classifyCommandRisk,
  executeSessionCommand,
} from '../../core/session/sessionCommand';

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
      return { success: result.success, data: { ...result, risk } };
    } catch (err) {
      return { success: false, error: `执行命令失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
