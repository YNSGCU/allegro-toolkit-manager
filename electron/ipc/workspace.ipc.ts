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
import { dialog, ipcMain } from 'electron';
import fs from 'fs';
import {
  copyWorkspace,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  loadWorkspaceStore,
  renameWorkspace,
  setActiveWorkspace,
  updateWorkspace,
} from '../../core/workspace/workspaceManager';
import { buildWorkspacePreview } from '../../core/workspace/buildWorkspacePreview';
import { loadAllProfiles } from '../../core/profile/hotkeyProfile';
import { loadSkillProfileStore } from '../../core/skill/skillProfileManager';
import { loadMenuProfileStore } from '../../core/menu/menuManager';
import { loadColorSchemeStore } from '../../core/color/colorSchemeManager';
import { loadEnvironmentRegistry, getActiveEnvironment } from '../../core/environment/environmentRegistry';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { planWorkspaceApplySequence, WORKSPACE_APPLY_ORDER } from '../../core/workspace/planWorkspaceApply';
import {
  applyWorkspaceImport,
  buildWorkspaceExportFileName,
  buildWorkspaceExportPackage,
  parseWorkspaceExportPackage,
  previewWorkspaceImport,
  serializeWorkspaceExportPackage,
} from '../../core/workspace/workspaceImportExport';
import path from 'path';
import type {
  WorkspaceBindingOptions,
  WorkspaceProfile,
  WorkspaceProfileBindings,
} from '../../src/types/workspaceProfile';

function loadBindingOptions(environmentId?: string): WorkspaceBindingOptions {
  const registry = loadEnvironmentRegistry();
  const selectedEnvironment = environmentId
    ? registry.environments.find((item) => item.id === environmentId) ?? null
    : getActiveEnvironment();
  if (environmentId && !selectedEnvironment) throw new Error('目标 Allegro 环境不存在');

  let pcbenvPath: string | null = null;
  try {
    pcbenvPath = locateEnvironment(selectedEnvironment?.pcbenvPath).pcbenvPath ?? null;
  } catch {
    // 环境尚不可用时仍返回环境和全局配色选项。
  }
  const atmDir = pcbenvPath ? path.join(pcbenvPath, 'atm_generated') : null;
  return {
    environmentId: selectedEnvironment?.id,
    environments: registry.environments.map((item) => ({ id: item.id, name: item.name })),
    hotkeyProfiles: pcbenvPath
      ? loadAllProfiles(pcbenvPath).map((item) => ({ id: item.id, name: item.name }))
      : [],
    skillProfiles: atmDir
      ? loadSkillProfileStore(atmDir).profiles.map((item) => ({ id: item.id, name: item.name }))
      : [],
    menuProfiles: atmDir
      ? (loadMenuProfileStore(atmDir).profiles ?? []).map((item) => ({ id: item.id, name: item.name }))
      : [],
    colorSchemes: loadColorSchemeStore().schemes.map((item) => ({ id: item.id, name: item.name })),
  };
}

function assertBindingExists(
  value: string | undefined,
  options: Array<{ id: string }>,
  label: string,
): void {
  if (value && !options.some((item) => item.id === value)) {
    throw new Error(`${label}不存在，请重新选择`);
  }
}

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

  ipcMain.handle('workspace:binding-options', (_event, environmentId?: string) => {
    try {
      return { success: true, data: loadBindingOptions(environmentId) };
    } catch (err) {
      return { success: false, error: `加载工作区绑定选项失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('workspace:update', (_event, workspaceId: string, bindings: Partial<WorkspaceProfileBindings>) => {
    try {
      const existing = getWorkspace(workspaceId);
      if (!existing) return { success: false, error: '工作区不存在' };
      const targetEnvironmentId = Object.prototype.hasOwnProperty.call(bindings, 'environmentId')
        ? bindings.environmentId
        : existing.environmentId;
      const options = loadBindingOptions(targetEnvironmentId);
      assertBindingExists(bindings.hotkeyProfileId, options.hotkeyProfiles, '快捷键方案');
      assertBindingExists(bindings.skillProfileId, options.skillProfiles, 'Skill 方案');
      assertBindingExists(bindings.menuProfileId, options.menuProfiles, '菜单方案');
      assertBindingExists(bindings.colorSchemeId, options.colorSchemes, '配色方案');
      const workspace = updateWorkspace(workspaceId, bindings);
      if (!workspace) return { success: false, error: '工作区不存在' };
      return { success: true, data: workspace };
    } catch (err) {
      return { success: false, error: `更新工作区失败: ${err instanceof Error ? err.message : String(err)}` };
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

  // 导出工作区方案为 JSON 文件（只含组合关系）
  ipcMain.handle('workspace:export', async (_event, workspaceId: string) => {
    try {
      const workspace = getWorkspace(workspaceId);
      if (!workspace) return { success: false, error: '工作区不存在' };

      const defaultPath = buildWorkspaceExportFileName(workspace.name);
      const result = await dialog.showSaveDialog({
        title: '导出工作区方案',
        defaultPath,
        filters: [
          { name: 'ATM 工作区方案', extensions: ['json'] },
          { name: 'JSON 文件', extensions: ['json'] },
        ],
      });
      if (result.canceled || !result.filePath) {
        return { success: true, data: null, info: '取消导出' };
      }

      const pkg = buildWorkspaceExportPackage(workspace);
      fs.writeFileSync(result.filePath, serializeWorkspaceExportPackage(pkg), 'utf-8');
      return {
        success: true,
        data: {
          filePath: result.filePath,
          fileName: path.basename(result.filePath),
          name: workspace.name,
        },
      };
    } catch (err) {
      return { success: false, error: `导出工作区方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 选择并解析工作区方案文件，仅返回预览，不写入存储
  ipcMain.handle('workspace:import-open', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '导入工作区方案',
        properties: ['openFile'],
        filters: [
          { name: 'ATM 工作区方案', extensions: ['json'] },
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null, info: '取消选择' };
      }

      const filePath = result.filePaths[0];
      const text = fs.readFileSync(filePath, 'utf-8');
      const pkg = parseWorkspaceExportPackage(text);
      const preview = previewWorkspaceImport(pkg, filePath);
      return { success: true, data: preview };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // 确认导入：重新读取文件、校验 JSON 并创建新工作区（新 ID，重名自动加「（导入）」）
  ipcMain.handle('workspace:import-commit', (_event, filePath: string, nameOverride?: string) => {
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      const pkg = parseWorkspaceExportPackage(text);
      const workspace = applyWorkspaceImport(pkg, nameOverride);
      return { success: true, data: { workspace, fileName: path.basename(filePath) } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
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
