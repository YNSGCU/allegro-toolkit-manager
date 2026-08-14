/**
 * ATM - 配色方案 IPC 处理器
 *
 * 提供配色方案的捕获 / 可视化数据 / 应用 / CRUD / .col 导入导出。
 * 应用配色属于修改 Allegro 会话状态的写入，UI 必须先经 Apply Plan 确认。
 */
import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  captureColorScheme,
  applyColorSchemeSmart,
  applyLivePalette,
  buildColorApplyPreview,
  queryTargetLayerInfo,
  checkColorBridge,
} from '../../core/color/vibeColorBridge';
import { parseColorColFile, generateColorColFile } from '../../core/color/colorPalette';
import {
  deleteColorUndoSnapshot,
  loadColorUndoSnapshot,
  saveColorUndoSnapshot,
} from '../../core/color/colorUndo';
import {
  checkBridgeSetupForEnvironments,
  buildAllEnvironmentsBridgeEnablePlan,
  findBridgeServerFile,
  summarizeBridgeSetup,
  type BridgeInstallTarget,
} from '../../core/color/vibeBridgeInstaller';
import { consumeTrustedApplyPlan, registerTrustedApplyPlan } from './trustedApplyPlan';
import {
  loadColorSchemeStore,
  createColorScheme,
  copyColorScheme,
  renameColorScheme,
  deleteColorScheme,
  setActiveColorScheme,
  getColorScheme,
  updateColorScheme,
} from '../../core/color/colorSchemeManager';
import type { ColorSchemeSnapshot } from '../../src/types/color';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { loadEnvironmentRegistry } from '../../core/environment/environmentRegistry';

/** 收集所有已发现的 Allegro 环境目标；注册表为空时回退到当前定位环境 */
function bridgeInstallTargets(): BridgeInstallTarget[] {
  const registry = loadEnvironmentRegistry();
  const targets = registry.environments
    .filter((environment) => environment.exists && environment.ilinitFilePath)
    .map((environment): BridgeInstallTarget => ({
      environmentId: environment.id,
      allegroVersion: environment.allegroVersion,
      ilinitPath: environment.ilinitFilePath,
    }));
  if (targets.length > 0) return targets;

  const envInfo = locateEnvironment();
  const ilinitPath = envInfo.ilinitFilePath
    || (envInfo.pcbenvPath ? path.join(envInfo.pcbenvPath, 'allegro.ilinit') : null);
  if (!ilinitPath) return [];
  return [{
    environmentId: envInfo.environmentId ?? null,
    allegroVersion: envInfo.allegroVersion ?? null,
    ilinitPath,
  }];
}

export function registerColorIpc(): void {
  // 检查 Vibe Bridge 可用性
  ipcMain.handle('color:check-bridge', async () => {
    try {
      const bridgeStatus = await checkColorBridge();
      return { success: true, data: bridgeStatus };
    } catch (err) {
      return { success: false, error: `检查 Vibe Bridge 失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 从当前打开的 Allegro 板子捕获配色
  ipcMain.handle('color:capture', async () => {
    try {
      const bridgeStatus = await checkColorBridge();
      if (!bridgeStatus.connected) {
        return { success: false, error: bridgeStatus.message };
      }
      const snapshot = await captureColorScheme({ workspace: bridgeStatus.bridgeWorkspace ?? undefined });
      // 记录捕获时的 Allegro 版本，供跨版本应用时提示差异
      snapshot.source = {
        ...snapshot.source,
        allegroVersion: bridgeStatus.allegroVersion ?? snapshot.source?.allegroVersion ?? null,
      };
      return { success: true, data: { snapshot, bridgeStatus } };
    } catch (err) {
      return { success: false, error: `捕获配色失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 应用方案到当前打开的板子（UI 确认后调用）
  ipcMain.handle('color:apply', async (_event, schemeId: string, applyVisibility?: boolean) => {
    try {
      const scheme = getColorScheme(schemeId);
      if (!scheme) {
        return { success: false, error: '配色方案不存在' };
      }
      const bridgeStatus = await checkColorBridge();
      if (!bridgeStatus.connected) {
        return { success: false, error: bridgeStatus.message };
      }

      // 应用前自动保存当前板子配色快照，用于"撤销本次配色"
      const beforeSnapshot = await captureColorScheme({
        workspace: bridgeStatus.bridgeWorkspace ?? undefined,
      });
      const undo = saveColorUndoSnapshot(beforeSnapshot, scheme.name);

      const result = await applyColorSchemeSmart(scheme, {
        workspace: bridgeStatus.bridgeWorkspace ?? undefined,
        applyVisibility: applyVisibility ?? false,
      });
      return {
        success: true,
        data: {
          result,
          schemeName: scheme.name,
          sourceAllegroVersion: scheme.source?.allegroVersion ?? null,
          targetAllegroVersion: bridgeStatus.allegroVersion ?? null,
          undoSnapshotId: undo.id,
        },
      };
    } catch (err) {
      return { success: false, error: `应用配色失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 生成应用预览（查询目标板叠层并计算最终颜色映射）
  ipcMain.handle('color:apply-preview', async (_event, schemeId: string, applyVisibility?: boolean) => {
    try {
      const scheme = getColorScheme(schemeId);
      if (!scheme) {
        return { success: false, error: '配色方案不存在' };
      }
      const bridgeStatus = await checkColorBridge();
      if (!bridgeStatus.connected) {
        return { success: false, error: bridgeStatus.message };
      }
      const target = await queryTargetLayerInfo({
        workspace: bridgeStatus.bridgeWorkspace ?? undefined,
      });
      const preview = buildColorApplyPreview(scheme, target, {
        applyVisibility: applyVisibility ?? false,
      });
      return {
        success: true,
        data: {
          preview,
          schemeName: scheme.name,
          sourceAllegroVersion: scheme.source?.allegroVersion ?? null,
          targetAllegroVersion: bridgeStatus.allegroVersion ?? null,
        },
      };
    } catch (err) {
      return { success: false, error: `生成配色应用预览失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 撤销本次配色（把应用前保存的快照恢复回去）
  ipcMain.handle('color:undo-apply', async (_event, undoSnapshotId: string) => {
    try {
      const undo = loadColorUndoSnapshot(undoSnapshotId);
      if (!undo) {
        return { success: false, error: '撤销快照不存在或已失效' };
      }
      const bridgeStatus = await checkColorBridge();
      if (!bridgeStatus.connected) {
        return { success: false, error: bridgeStatus.message };
      }
      const result = await applyColorSchemeSmart(undo.snapshot, {
        workspace: bridgeStatus.bridgeWorkspace ?? undefined,
        applyVisibility: true,
      });
      deleteColorUndoSnapshot(undoSnapshotId);
      return {
        success: true,
        data: {
          result,
          schemeName: undo.schemeName,
          restoredSnapshotId: undoSnapshotId,
        },
      };
    } catch (err) {
      return { success: false, error: `撤销配色失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 实时预览：仅将当前方案的调色板/背景色推送到当前板子（不改图层分配）
  ipcMain.handle('color:live-palette', async (_event, schemeId: string) => {
    try {
      const scheme = getColorScheme(schemeId);
      if (!scheme) {
        return { success: false, error: '配色方案不存在' };
      }
      const bridgeStatus = await checkColorBridge();
      if (!bridgeStatus.connected) {
        return { success: false, error: bridgeStatus.message };
      }

      // 预览前保存当前板子快照，供「撤销本次配色」恢复
      const beforeSnapshot = await captureColorScheme({
        workspace: bridgeStatus.bridgeWorkspace ?? undefined,
      });
      const undo = saveColorUndoSnapshot(beforeSnapshot, `${scheme.name}（实时预览前）`);

      // 使用目标板调色板数量规范化，避免跨版本截断/越界
      const target = await queryTargetLayerInfo({
        workspace: bridgeStatus.bridgeWorkspace ?? undefined,
      });

      const result = await applyLivePalette(scheme.palette, {
        workspace: bridgeStatus.bridgeWorkspace ?? undefined,
        colorCount: target.colorCount,
        background: scheme.background,
      });

      return {
        success: true,
        data: {
          result,
          schemeName: scheme.name,
          undoSnapshotId: undo.id,
        },
      };
    } catch (err) {
      return { success: false, error: `实时预览配色失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 加载全部方案
  ipcMain.handle('color:schemes', () => {
    try {
      return { success: true, data: loadColorSchemeStore() };
    } catch (err) {
      return { success: false, error: `加载配色方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 将捕获快照保存为方案
  ipcMain.handle('color:scheme-create', (_event, snapshot: ColorSchemeSnapshot, name: string, description?: string) => {
    try {
      const scheme = createColorScheme(snapshot, name, description);
      return { success: true, data: scheme };
    } catch (err) {
      return { success: false, error: `创建配色方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 复制方案
  ipcMain.handle('color:scheme-copy', (_event, schemeId: string, newName?: string) => {
    try {
      const scheme = copyColorScheme(schemeId, newName);
      if (!scheme) return { success: false, error: '配色方案不存在' };
      return { success: true, data: scheme };
    } catch (err) {
      return { success: false, error: `复制配色方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 重命名方案
  ipcMain.handle('color:scheme-rename', (_event, schemeId: string, newName: string) => {
    try {
      const scheme = renameColorScheme(schemeId, newName);
      if (!scheme) return { success: false, error: '配色方案不存在或名称为空' };
      return { success: true, data: scheme };
    } catch (err) {
      return { success: false, error: `重命名配色方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 删除方案
  ipcMain.handle('color:scheme-delete', (_event, schemeId: string) => {
    try {
      const result = deleteColorScheme(schemeId);
      return result.success
        ? { success: true }
        : { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: `删除配色方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 设置激活方案
  ipcMain.handle('color:scheme-set-active', (_event, schemeId: string) => {
    try {
      const scheme = setActiveColorScheme(schemeId);
      if (!scheme) return { success: false, error: '配色方案不存在' };
      return { success: true, data: scheme };
    } catch (err) {
      return { success: false, error: `切换配色方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 导入 .col 文件（仅调色板，无图层分配）
    // 更新方案（编辑调色板颜色 / 图层颜色后保存）
  ipcMain.handle('color:scheme-update', (_event, schemeId: string, updates: any) => {
    try {
      const scheme = updateColorScheme(schemeId, updates);
      if (!scheme) {
        return { success: false, error: '配色方案不存在' };
      }
      return { success: true, data: scheme };
    } catch (err) {
      return { success: false, error: `更新配色方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

ipcMain.handle('color:import-col', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '导入 Allegro 配色文件',
        properties: ['openFile'],
        filters: [{ name: 'Allegro Color', extensions: ['col', 'txt'] }],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseColorColFile(content);
      return {
        success: true,
        data: { ...parsed, fileName: path.basename(filePath), filePath },
      };
    } catch (err) {
      return { success: false, error: `导入 .col 文件失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 导出 .col 文件（调色板部分）
  ipcMain.handle('color:export-col', async (_event, schemeId: string) => {
    try {
      const scheme = getColorScheme(schemeId);
      if (!scheme) return { success: false, error: '配色方案不存在' };
      const result = await dialog.showSaveDialog({
        title: '导出 Allegro 配色文件',
        defaultPath: `${scheme.name || 'color_scheme'}.col`,
        filters: [{ name: 'Allegro Color', extensions: ['col'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: true, data: null };
      }
      const content = generateColorColFile(scheme.palette, scheme.background);
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, data: result.filePath };
    } catch (err) {
      return { success: false, error: `导出 .col 文件失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
  // 检查桥接安装状态（自动加载是否已配置到 ilinit）
  ipcMain.handle('color:bridge-setup-status', () => {
    try {
      const targets = bridgeInstallTargets();
      const environments = checkBridgeSetupForEnvironments(targets);
      return {
        success: true,
        data: summarizeBridgeSetup(environments),
      };
    } catch (err) {
      return { success: false, error: `检查桥接安装状态失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 生成「启用桥接自动加载」的 Apply Plan
  ipcMain.handle('color:bridge-enable-plan', () => {
    try {
      const targets = bridgeInstallTargets();
      if (targets.length === 0) return { success: false, error: '未找到 allegro.ilinit 路径' };
      const serverFile = findBridgeServerFile();
      if (!serverFile) return { success: false, error: '未找到 vibe_server.il，无法启用 Vibe Bridge' };

      const firstPcbenv = path.dirname(targets[0].ilinitPath);
      const backupBase = path.join(
        firstPcbenv,
        'atm_generated',
        'backup',
        new Date().toISOString().replace(/[:.]/g, '-'),
      );
      const plan = buildAllEnvironmentsBridgeEnablePlan(
        targets,
        serverFile,
        backupBase,
      );
      if (!plan) return { success: true, data: null, info: '所有环境均已配置桥接，无需重复启用' };
      return { success: true, data: registerTrustedApplyPlan(plan, 'color-bridge') };
    } catch (err) {
      return { success: false, error: `生成启用桥接计划失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 执行启用桥接自动加载的 Apply Plan
  ipcMain.handle('color:bridge-execute-plan', async (_event, planJson: string) => {
    try {
      const { executeApplyPlan } = await import('../../core/apply/applyPlanEngine');
      const plan = consumeTrustedApplyPlan(planJson, 'color-bridge', 'environment');
      const firstTarget = plan.targetFiles[0];
      const backupDir = firstTarget
        ? path.join(path.dirname(firstTarget), 'atm_generated', 'backup', new Date().toISOString().replace(/[:.]/g, '-'))
        : path.join(process.cwd(), 'atm_generated', 'backup', new Date().toISOString().replace(/[:.]/g, '-'));
      const result = await executeApplyPlan(plan, { backupDir });
      return { success: result.appliedSteps === result.totalSteps && result.totalSteps > 0, data: result };
    } catch (err) {
      return { success: false, error: `执行启用桥接计划失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
