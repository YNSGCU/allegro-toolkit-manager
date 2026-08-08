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
  getWorkspace,
  listWorkspaces,
  loadWorkspaceStore,
  renameWorkspace,
  setActiveWorkspace,
} from '../../core/workspace/workspaceManager';
import { buildWorkspacePreview } from '../../core/workspace/buildWorkspacePreview';
import { loadAllProfiles } from '../../core/profile/hotkeyProfile';
import { loadSkillProfileStore } from '../../core/skill/skillProfileManager';
import { loadMenuProfileStore } from '../../core/menu/menuManager';
import { loadColorSchemeStore } from '../../core/color/colorSchemeManager';
import { loadEnvironmentRegistry, getActiveEnvironment } from '../../core/environment/environmentRegistry';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { planWorkspaceApplySequence, WORKSPACE_APPLY_ORDER } from '../../core/workspace/planWorkspaceApply';
import path from 'path';
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

  ipcMain.handle('workspace:preview', (_event, workspaceId: string) => {
    try {
      const workspace = getWorkspace(workspaceId);
      if (!workspace) return { success: false, error: '工作区不存在' };

      // 环境：优先按工作区绑定的 environmentId，回退到当前激活环境
      const registry = loadEnvironmentRegistry();
      const environmentId = workspace.environmentId || getActiveEnvironment()?.id;
      const environment = environmentId
        ? registry.environments.find((item) => item.id === environmentId) ?? null
        : null;
      let pcbenvPath: string | undefined;
      let allegroVersion: string | null = null;
      try {
        const envInfo = locateEnvironment(environment?.pcbenvPath);
        pcbenvPath = envInfo.pcbenvPath ?? undefined;
        allegroVersion = envInfo.allegroVersion ?? null;
      } catch {
        // 环境不可用时预览仍可展示子方案存在性
      }
      const envPreview = {
        environmentId: environmentId ?? undefined,
        name: environment?.name,
        pcbenvPath,
        allegroVersion: allegroVersion ?? undefined,
      };

      const atmDir = pcbenvPath ? path.join(pcbenvPath, 'atm_generated') : null;
      const preview = buildWorkspacePreview(workspace, envPreview, {
        hotkeyProfiles: pcbenvPath
          ? loadAllProfiles(pcbenvPath).map((profile) => ({
              id: profile.id,
              name: profile.name,
              bindingCount: profile.bindings?.length,
            }))
          : [],
        skillProfiles: atmDir
          ? loadSkillProfileStore(atmDir).profiles.map((profile) => ({
              id: profile.id,
              name: profile.name,
              itemCount: profile.skillStates?.length ?? profile.loadOrder?.length,
            }))
          : [],
        menuProfiles: atmDir
          ? (loadMenuProfileStore(atmDir).profiles ?? []).map((profile) => ({
              id: profile.id,
              name: profile.name,
              itemCount: profile.items?.length,
            }))
          : [],
        colorSchemes: loadColorSchemeStore().schemes.map((scheme) => ({
          id: scheme.id,
          name: scheme.name,
          layerCount: scheme.layers?.length,
          colorCount: scheme.palette?.length,
        })),
      });

      return { success: true, data: { preview } };
    } catch (err) {
      return { success: false, error: `生成工作区预览失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('workspace:apply-plan', (_event, workspaceId: string, options?: { applyVisibility?: boolean }) => {
    try {
      const workspace = getWorkspace(workspaceId);
      if (!workspace) return { success: false, error: '工作区不存在' };

      const registry = loadEnvironmentRegistry();
      const currentEnvironmentId = getActiveEnvironment()?.id ?? null;
      const environment = workspace.environmentId || currentEnvironmentId
        ? registry.environments.find((item) => item.id === (workspace.environmentId || currentEnvironmentId)) ?? null
        : null;
      let pcbenvPath: string | null = null;
      let envFilePath: string | null = null;
      try {
        const envInfo = locateEnvironment(environment?.pcbenvPath);
        pcbenvPath = envInfo.pcbenvPath ?? null;
        envFilePath = envInfo.envFilePath ?? null;
      } catch {
        // 环境不可用时由序列校验提示
      }

      // 模块可用性：方案是否存在
      const atmDir = pcbenvPath ? path.join(pcbenvPath, 'atm_generated') : null;
      const skillAvailable = Boolean(atmDir && workspace.skillProfileId
        && loadSkillProfileStore(atmDir).profiles.some((p) => p.id === workspace.skillProfileId));
      const menuAvailable = Boolean(atmDir && workspace.menuProfileId
        && (loadMenuProfileStore(atmDir).profiles ?? []).some((p) => p.id === workspace.menuProfileId));
      const hotkeyAvailable = Boolean(pcbenvPath && workspace.hotkeyProfileId
        && loadAllProfiles(pcbenvPath).some((p) => p.id === workspace.hotkeyProfileId));
      const colorAvailable = Boolean(workspace.colorSchemeId
        && loadColorSchemeStore().schemes.some((s) => s.id === workspace.colorSchemeId));

      const sequence = planWorkspaceApplySequence(workspace, currentEnvironmentId, {
        skill: skillAvailable,
        menu: menuAvailable,
        hotkey: hotkeyAvailable,
        color: colorAvailable,
      });

      return {
        success: true,
        data: {
          sequence: {
            order: sequence.order,
            warnings: sequence.warnings,
            blocked: sequence.blocked,
            blockedReason: sequence.blockedReason,
          },
          env: {
            environmentId: workspace.environmentId ?? currentEnvironmentId ?? undefined,
            pcbenvPath,
            envFilePath,
          },
          applyOrder: WORKSPACE_APPLY_ORDER,
          applyVisibility: options?.applyVisibility ?? false,
        },
      };
    } catch (err) {
      return { success: false, error: `生成工作区应用计划失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
