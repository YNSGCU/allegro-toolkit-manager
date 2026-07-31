/**
 * ATM - env 导入 IPC 处理器（V4.0）
 *
 * 处理外部 .env 文件的导入流程：
 *   1. 打开文件选择对话框
 *   2. 读取并解析文件
 *   3. 生成导入预览
 *   4. 根据导入模式执行
 */
import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  buildEnvImportPreview,
  computeImportConflicts,
  executeImport,
} from '../../core/profile/importEnv';
import type { EnvImportPreview, ImportConflictItem, ImportExecuteParams } from '../../src/types/importEnv';
import type { HotkeyBinding } from '../../src/types/hotkey';

export function registerImportIpc(): void {
  /**
   * 打开文件选择对话框，选择 .env 文件
   * 返回选中文件的路径（取消时返回 null）
   */
  ipcMain.handle('import:open-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择要导入的 env 文件',
        properties: ['openFile'],
        filters: [
          { name: 'Allegro env 文件', extensions: ['env'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null, info: '取消选择' };
      }

      const selectedPath = result.filePaths[0];

      // 验证文件存在且可读
      if (!fs.existsSync(selectedPath)) {
        return { success: false, error: '文件不存在' };
      }

      const stats = fs.statSync(selectedPath);
      if (!stats.isFile()) {
        return { success: false, error: '所选路径不是文件' };
      }

      return { success: true, data: selectedPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `打开文件对话框失败: ${message}` };
    }
  });

  /**
   * 读取并解析外部 env 文件，生成预览
   * @param _event
   * @param filePath 文件路径
   * @returns EnvImportPreview
   */
  ipcMain.handle('import:parse-file', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const preview = buildEnvImportPreview(filePath, content);

      return { success: true, data: preview };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `解析 env 文件失败: ${message}` };
    }
  });

  /**
   * 计算导入快捷键与当前环境的冲突
   * @param _event
   * @param params { entries, currentBindings, reservedBindings }
   * @returns ImportConflictItem[]
   */
  ipcMain.handle('import:compute-conflicts', (_event, params: {
    entries: Array<{ key: string; command: string; type: 'funckey' | 'alias' }>;
    currentBindings: HotkeyBinding[];
    reservedBindings?: HotkeyBinding[];
  }) => {
    try {
      const conflicts = computeImportConflicts(
        params.entries,
        params.currentBindings,
        params.reservedBindings,
      );
      return { success: true, data: conflicts };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `计算导入冲突失败: ${message}` };
    }
  });

  /**
   * 执行 env 导入
   * @param _event
   * @param params ImportExecuteParams
   * @returns ImportResult
   */
  ipcMain.handle('import:execute', (_event, params: ImportExecuteParams) => {
    try {
      const result = executeImport(params);
      return { success: result.success, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `执行导入失败: ${message}` };
    }
  });
}
