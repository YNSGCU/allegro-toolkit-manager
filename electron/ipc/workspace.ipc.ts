/**
 * ATM - 统一工作区方案 IPC 处理器
 *
 * 通道：
 *  - workspace:load-all      加载全部工作区
 *  - workspace:create        创建
 *  - workspace:copy          复制
 *  - workspace:rename        重命名
 *  - workspace:delete        删除（默认工作区保护）
 *  - workspace:set-active    设置激活
 */
import { ipcMain } from 'electron';
import {
  copyWorkspace,
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  loadWorkspaceStore,
  renameWorkspace,
  setActiveWorkspace,
} from '../../core/workspace/workspaceManager';
import type { WorkspaceProfile } from '../../src/types/workspaceProfile';

export function registerWorkspaceIpc(): void {
  ipcMain.handle('workspace:load-all', () => {
    try {
      return { success: true, data: loadWorkspaceStore() };
    } catch (err) {
      return { success: false, error: `加载工作区失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle(
    'workspace:create',
    (_event, name: string, options?: Partial<Pick<WorkspaceProfile, 'description' | 'environmentId' | 'hotkeyProfileId' | 'skillProfileId' | 'menuProfileId' | 'colorSchemeId'>>) => {
      try {
        const workspace = createWorkspace(name, options ?? {});
        return { success: true, data: workspace };
      } catch (err) {
        return { success: false, error: `创建工作区失败: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  );

  ipcMain.handle('workspace:copy', (_event, workspaceId: string, newName?: string) => {
    try {
      const workspace = copyWorkspace(workspaceId, newName);
      if (!workspace) return { success: false, error: '工作区不存在' };
      return { success: true, data: workspace };
    } catch (err) {
      return { success: false, error: `复制工作区失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('workspace:rename', (_event, workspaceId: string, newName: string) => {
    try {
      const workspace = renameWorkspace(workspaceId, newName);
      if (!workspace) return { success: false, error: '工作区不存在或名称为空' };
      return { success: true, data: workspace };
    } catch (err) {
      return { success: false, error: `重命名工作区失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('workspace:delete', (_event, workspaceId: string) => {
    try {
      const result = deleteWorkspace(workspaceId);
      return result.success
        ? { success: true }
        : { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: `删除工作区失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('workspace:set-active', (_event, workspaceId: string) => {
    try {
      const workspace = setActiveWorkspace(workspaceId);
      if (!workspace) return { success: false, error: '工作区不存在' };
      return { success: true, data: workspace };
    } catch (err) {
      return { success: false, error: `设置激活工作区失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
