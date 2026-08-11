/**
 * ATM - 环境检测 IPC 处理器（V3.0 多 env 支持）
 */
import { ipcMain, dialog, shell } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { locateEnvironment, calculateHealthScore, ensureAtmDirectoryStructure } from '../../core/environment/locateEnvironment';
import { checkFileAccess } from '../../core/environment/fileAccess';
import { scanEnvSources } from '../../core/environment/scanEnvSources';
import {
  loadSettings, saveSettings, setActiveEnvPath,
  addReferenceEnvPath, removeReferenceEnvPath,
} from '../../core/settings/atmSettings';
import {
  loadEnvironmentRegistry,
  refreshEnvironmentRegistry,
  setActiveEnvironment,
  addManualInstallRoot,
  removeManualInstallRoot,
} from '../../core/environment/environmentRegistry';
import { listCompatibilityRecords, saveCompatibilityRecord } from '../../core/environment/compatibilityRecords';
import { verifyAllegroRuntimeViaVibeBridge } from '../../core/environment/vibeBridgeProbe';
import { buildAllegroLaunchSpec } from '../../core/environment/allegroLauncher';

export function registerEnvIpc(): void {
  ipcMain.handle('env:list-workspaces', (_event, refresh = false, manualPcbenvPath?: string) => {
    try {
      const stored = loadEnvironmentRegistry();
      const registry = refresh || manualPcbenvPath || stored.environments.length === 0
        ? refreshEnvironmentRegistry(manualPcbenvPath)
        : stored;
      return {
        success: true,
        data: {
          ...registry,
          hostEnvironment: {
            homePath: process.env.HOME || null,
            cdsRoot: process.env.CDSROOT || null,
          },
        },
      };
    } catch (err) {
      return { success: false, error: `扫描 Allegro 环境失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('env:set-active-workspace', (_event, environmentId: string) => {
    try {
      const registry = setActiveEnvironment(environmentId);
      const environment = registry.environments.find((item) => item.id === environmentId);
      return { success: true, data: { registry, environment } };
    } catch (err) {
      return { success: false, error: `切换 Allegro 环境失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('env:launch-workspace', async (_event, environmentId: string) => {
    try {
      const registry = loadEnvironmentRegistry();
      const environment = registry.environments.find((item) => item.id === environmentId);
      if (!environment) return { success: false, error: '目标 Allegro 环境不存在' };

      const spec = buildAllegroLaunchSpec(environment);
      if (!fs.existsSync(spec.executablePath) || !fs.statSync(spec.executablePath).isFile()) {
        return { success: false, error: `Allegro 可执行文件不存在：${spec.executablePath}` };
      }

      const child = spawn(spec.executablePath, [], {
        cwd: spec.cwd,
        env: spec.env,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
      child.unref();

      return {
        success: true,
        data: {
          pid: child.pid ?? null,
          environmentId: environment.id,
          allegroVersion: environment.allegroVersion,
          homePath: spec.env.HOME ?? null,
          executablePath: spec.executablePath,
        },
      };
    } catch (err) {
      return { success: false, error: `启动 Allegro 失败：${err instanceof Error ? err.message : String(err)}` };
    }
  });

    // 手动添加 Allegro 安装根目录（新电脑上自动扫描找不到时用）
  ipcMain.handle('env:add-install-root', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择 Allegro 安装根目录（SPB_xx.x / Allegro_xx.x）',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }
      const selectedRoot = result.filePaths[0];
      const registry = addManualInstallRoot(selectedRoot);
      return { success: true, data: { registry, selectedRoot } };
    } catch (err) {
      return { success: false, error: `添加安装目录失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 移除手动安装目录
  ipcMain.handle('env:remove-install-root', (_event, installRoot: string) => {
    try {
      const registry = removeManualInstallRoot(installRoot);
      return { success: true, data: registry };
    } catch (err) {
      return { success: false, error: `移除安装目录失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

ipcMain.handle('env:list-compatibility-records', (_event, filters?: any) => {
    try {
      return { success: true, data: listCompatibilityRecords(filters) };
    } catch (err) {
      return { success: false, error: `读取兼容记录失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('env:save-compatibility-record', (_event, record: any) => {
    try {
      return { success: true, data: saveCompatibilityRecord(record) };
    } catch (err) {
      return { success: false, error: `保存兼容记录失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('env:verify-vibe-runtime', async (_event, environmentId: string) => {
    try {
      const registry = loadEnvironmentRegistry();
      const environment = registry.environments.find((item) => item.id === environmentId);
      if (!environment) return { success: false, error: '目标 Allegro 环境不存在' };
      const result = await verifyAllegroRuntimeViaVibeBridge(environment);
      const record = saveCompatibilityRecord({
        environmentId: environment.id,
        allegroVersion: environment.allegroVersion,
        scope: 'environment',
        subjectId: environment.id,
        subjectType: 'environment',
        status: result.status,
        evidenceSource: 'vibe_bridge',
        summary: result.message,
        details: JSON.stringify({ actualVersion: result.actualVersion, fullVersion: result.fullVersion, programName: result.programName }),
      });
      return { success: true, data: { result, record } };
    } catch (err) {
      return { success: false, error: `Vibe Bridge 验证失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // 定位 Allegro 配置环境
  ipcMain.handle('env:locate', (_event, manualPcbenvPath?: string) => {
    try {
      const envInfo = locateEnvironment(manualPcbenvPath);
      return { success: true, data: envInfo };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `环境检测失败: ${message}` };
    }
  });

  // 打开文件选择对话框选择 pcbenv 目录
  ipcMain.handle('env:select-pcbenv', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择 pcbenv 目录',
        properties: ['openDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      const selectedPath = result.filePaths[0];
      return { success: true, data: selectedPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `选择目录失败: ${message}` };
    }
  });

  // 检测文件访问状态
  ipcMain.handle('env:check-file-access', (_event, filePath: string) => {
    try {
      const status = checkFileAccess(filePath);
      return { success: true, data: status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `检测文件状态失败: ${message}` };
    }
  });

  // 计算环境健康评分
  ipcMain.handle('env:health-score', (_event) => {
    try {
      const envInfo = locateEnvironment();
      const health = calculateHealthScore(envInfo);
      return { success: true, data: { environment: envInfo, health } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `计算健康评分失败: ${message}` };
    }
  });

  // 获取 Windows 环境变量（供 UI 显示，不暴露敏感变量）
  ipcMain.handle('env:get-vars', (_event, names: string[]) => {
    try {
      const safeVars = ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CDS_SITE', 'SKILL_PATH', 'PATH'];
      const result: Record<string, string | null> = {};
      for (const name of names) {
        if (safeVars.includes(name)) {
          result[name] = process.env[name] ?? null;
        }
      }
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `获取环境变量失败: ${message}` };
    }
  });

  // ════════════════════════════════════════════════
  // V3.0 多 env 来源
  // ════════════════════════════════════════════════

  /** 扫描所有 env 来源 */
  ipcMain.handle('env:scan-all', (_event, manualPcbenvPath?: string) => {
    try {
      // 先检测环境以获取 pcbenvPath（用于加载设置）
      const envInfo = locateEnvironment(manualPcbenvPath);
      let settings = null;
      if (envInfo.pcbenvPath) {
        settings = loadSettings(envInfo.pcbenvPath);
      }
      const sources = scanEnvSources(settings, manualPcbenvPath);
      return { success: true, data: { sources, settings } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `扫描 env 来源失败: ${message}` };
    }
  });

  /** 加载设置 */
  ipcMain.handle('env:load-settings', (_event, pcbenvPath?: string) => {
    try {
      let path = pcbenvPath;
      if (!path) {
        const envInfo = locateEnvironment();
        path = envInfo.pcbenvPath || undefined;
      }
      if (!path) {
        return { success: true, data: null, warning: '未找到 pcbenv 路径' };
      }
      const settings = loadSettings(path);
      return { success: true, data: settings };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `加载设置失败: ${message}` };
    }
  });

  /** 保存设置 */
  ipcMain.handle('env:save-settings', (_event, pcbenvPath: string, settings: any) => {
    try {
      saveSettings(pcbenvPath, settings);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `保存设置失败: ${message}` };
    }
  });

  /** 设置当前活动 env */
  ipcMain.handle('env:set-active-env', (_event, pcbenvPath: string, envPath: string) => {
    try {
      const updated = setActiveEnvPath(pcbenvPath, envPath);
      return { success: true, data: updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `设置活动 env 失败: ${message}` };
    }
  });

  /** 添加参考 env（打开文件选择对话框） */
  ipcMain.handle('env:add-reference-env', async (_event, pcbenvPath: string) => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择参考 env 文件',
        properties: ['openFile'],
        filters: [{ name: 'Allegro env', extensions: ['env', 'dat'] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null, info: '取消选择' };
      }

      const selectedPath = result.filePaths[0];
      const updated = addReferenceEnvPath(pcbenvPath, selectedPath);
      return { success: true, data: updated, selectedPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `添加参考 env 失败: ${message}` };
    }
  });

  /** 移除参考 env */
  ipcMain.handle('env:remove-reference-env', (_event, pcbenvPath: string, refPath: string) => {
    try {
      const updated = removeReferenceEnvPath(pcbenvPath, refPath);
      return { success: true, data: updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `移除参考 env 失败: ${message}` };
    }
  });

  /** 打开 env 来源所在文件夹 */
  ipcMain.handle('env:open-source-folder', async (_event, sourcePath: string) => {
    try {
      if (!sourcePath) {
        return { success: false, error: '未提供 env 来源路径' };
      }

      const resolvedPath = path.resolve(sourcePath);
      const pathExists = fs.existsSync(resolvedPath);
      const sourceIsDirectory = pathExists && fs.statSync(resolvedPath).isDirectory();
      const targetPath = sourceIsDirectory ? resolvedPath : path.dirname(resolvedPath);

      if (!fs.existsSync(targetPath)) {
        return { success: false, error: '目标文件夹不存在' };
      }

      if (pathExists && !sourceIsDirectory) {
        shell.showItemInFolder(resolvedPath);
        return { success: true };
      }

      const errorMessage = await shell.openPath(targetPath);
      if (errorMessage) {
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `打开文件夹失败: ${message}` };
    }
  });

  // ════════════════════════════════════════════════
  // V4.0 原始行查看
  // ════════════════════════════════════════════════

  /** 读取 env 原始行（带上下文） */
  ipcMain.handle('env:read-raw-line', (_event, filePath: string, lineNumber: number, isReference?: boolean) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      if (lineNumber < 1 || lineNumber > lines.length) {
        return { success: false, error: '行号超出范围' };
      }

      const contextBefore = [];
      const start = Math.max(0, lineNumber - 6);
      for (let i = start; i < lineNumber - 1; i++) {
        contextBefore.push(`${i + 1}\t${lines[i]}`);
      }

      const contextAfter = [];
      const end = Math.min(lines.length, lineNumber + 5);
      for (let i = lineNumber; i < end; i++) {
        contextAfter.push(`${i + 1}\t${lines[i]}`);
      }

      return {
        success: true,
        data: {
          filePath,
          lineNumber,
          lineContent: lines[lineNumber - 1],
          contextBefore,
          contextAfter,
          isReference: !!isReference,
          exists: true,
        },
      };
    } catch (err) {
      return { success: false, error: `读取原始行失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 复制原始行内容 */
  ipcMain.handle('env:copy-raw-line', (_event, filePath: string, lineNumber: number) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      if (lineNumber < 1 || lineNumber > lines.length) {
        return { success: false, error: '行号超出范围' };
      }
      return { success: true, data: lines[lineNumber - 1] };
    } catch (err) {
      return { success: false, error: `复制原始行失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 获取 env 文件预览 */
  ipcMain.handle('env:file-preview', (_event, filePath: string, maxLines?: number) => {
    try {
      const max = maxLines || 50;
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      const truncated = lines.length > max;
      return {
        success: true,
        data: {
          lines: truncated ? lines.slice(0, max).map((l, i) => `${i + 1}\t${l}`) : lines.map((l, i) => `${i + 1}\t${l}`),
          totalLines: lines.length,
          truncated,
        },
      };
    } catch (err) {
      return { success: false, error: `文件预览失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
