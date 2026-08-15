/**
 * ATM - 变更历史 IPC 处理器（V4.0）
 */
import { ipcMain } from 'electron';
import path from 'path';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import {
  loadChangeHistory,
  saveChangeHistory,
  addChangeRecord,
  getLastChangeRecord,
  canUndoLastChange,
  undoLastChange,
  clearChangeHistory,
} from '../../core/changeHistory/changeHistory';
import {
  loadApplyPlanHistory,
  undoLastChange as undoApplyPlanLastChange,
} from '../../core/apply/applyPlanEngine';

export function registerHistoryIpc(): void {
  /** 加载变更历史 */
  ipcMain.handle('history:load', (_event, pcbenvPath: string) => {
    try {
      const history = loadChangeHistory(pcbenvPath);
      return { success: true, data: history };
    } catch (err) {
      return { success: false, error: `加载变更历史失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 获取上次可撤销的变更 */
  ipcMain.handle('history:get-last', (_event, pcbenvPath: string) => {
    try {
      const { canUndo, record } = canUndoLastChange(pcbenvPath);
      return { success: true, data: { canUndo, record } };
    } catch (err) {
      return { success: false, error: `获取上次变更失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 撤销上次变更 */
  ipcMain.handle('history:undo', (_event, pcbenvPath: string) => {
    try {
      const result = undoLastChange(pcbenvPath);
      return result;
    } catch (err) {
      return { success: false, error: `撤销失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 添加变更记录 */
  ipcMain.handle('history:add', (_event, pcbenvPath: string, record: any) => {
    try {
      const fullRecord = addChangeRecord(pcbenvPath, record);
      return { success: true, data: fullRecord };
    } catch (err) {
      return { success: false, error: `添加变更记录失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 清空变更历史 */
  ipcMain.handle('history:clear', (_event, pcbenvPath: string) => {
    try {
      clearChangeHistory(pcbenvPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: `清空变更历史失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 统一 Apply Plan 历史目录（Skill/Menu 等模块共用） */
  function getAtmHistoryDirs(): { historyDir: string; backupDir: string } {
    const envInfo = locateEnvironment();
    const atmDir = envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
    return { historyDir: path.join(atmDir, 'history'), backupDir: path.join(atmDir, 'backups') };
  }

  /** 加载统一 Apply Plan 变更历史 */
  ipcMain.handle('history:apply-plan-list', () => {
    try {
      const { historyDir } = getAtmHistoryDirs();
      return { success: true, data: loadApplyPlanHistory(historyDir) };
    } catch (err) {
      return { success: false, error: '加载应用历史失败: ' + (err instanceof Error ? err.message : String(err)) };
    }
  });

  /** 撤销最近一次统一 Apply Plan 变更 */
  ipcMain.handle('history:apply-plan-undo', async () => {
    try {
      const { historyDir, backupDir } = getAtmHistoryDirs();
      return await undoApplyPlanLastChange(historyDir, backupDir);
    } catch (err) {
      return { success: false, error: '撤销应用失败: ' + (err instanceof Error ? err.message : String(err)) };
    }
  });
}
