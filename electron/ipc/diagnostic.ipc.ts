/**
 * ATM - 设计体检 IPC 处理器
 */
import { ipcMain } from 'electron';
import { runBoardDiagnostic } from '../../core/diagnostic/boardDiagnostic';

export function registerDiagnosticIpc(): void {
  ipcMain.handle('diagnostic:run', async () => {
    try {
      const snapshot = await runBoardDiagnostic();
      return { success: true, data: snapshot };
    } catch (err) {
      return { success: false, error: `设计体检失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
