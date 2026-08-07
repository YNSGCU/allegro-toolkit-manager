/**
 * ATM - 应用运行时信息 IPC 处理程序（V5.4）
 *
 * 提供 main/preload/renderer 三层版本一致性自检功能。
 * 当用户遇到 "No handler registered" 错误时，此模块提供明确的中文诊断信息。
 */
import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import type { RuntimeInfo, IpcHandlerInfo } from '../../src/types/runtime';

/** 主进程启动时间戳（作为构建时间的近似值） */
const MAIN_START_TIME: string = new Date().toISOString();

/** 收集所有已注册的 IPC handler 列表 */
function collectRegisteredHandlers(): IpcHandlerInfo[] {
  const knownHandlers: string[] = [
    // app
    'app:getRuntimeInfo',
    'app:update-state',
    'app:update-settings',
    'app:update-settings-save',
    'app:update-check',
    'app:update-download',
    'app:update-install',
    // env
    'env:locate',
    'env:list-workspaces',
    'env:set-active-workspace',
    'env:list-compatibility-records',
    'env:save-compatibility-record',
    'env:verify-vibe-runtime',
    'env:select-pcbenv',
    'env:check-file-access',
    'env:health-score',
    'env:get-vars',
    'env:scan-all',
    'env:load-settings',
    'env:save-settings',
    'env:set-active-env',
    'env:add-reference-env',
    'env:remove-reference-env',
    'env:read-raw-line',
    'env:copy-raw-line',
    'env:file-preview',
    // hotkey
    'hotkey:parse-env',
    'hotkey:validate',
    'hotkey:create-backup',
    'hotkey:create-apply-plan',
    'hotkey:apply-plan',
    'hotkey:get-reserved',
    'hotkey:validate-edit',
    'hotkey:generate-edit-plan',
    'hotkey:generate-add-plan',
    'hotkey:execute-edit-plan',
    'hotkey:enhanced-conflicts',
    'hotkey:recommended-keys',
    'hotkey:export',
    'hotkey:save-export',
    // profile
    'profile:list',
    'profile:create',
    'profile:copy',
    'profile:rename',
    'profile:delete',
    'profile:export',
    'profile:import',
    'profile:diff',
    'profile:save-bindings',
    'profile:check-compatibility',
    'profile:migrate',
    // command
    'command:save-override',
    // skill V1/V2
    'skill:scan',
    'skill:parse-file',
    'skill:get-registry',
    'skill:toggle',
    'skill:generate-loader',
    'skill:validate-refs',
    'skill:apply-skill-changes',
    // skill V4.0
    'skill:check-load',
    'skill:check-all-load',
    'skill:scan-load-sources',
    // skill V4.5 enhanced
    'skill:enhanced-scan',
    'skill:enhanced-commands',
    'skill:file-detail',
    'skill:enhanced-refs',
    'skill:add-readonly-dir',
    'skill:select-readonly-dir',
    'skill:import-preview',
    // skill V5.1 impact analysis
    'skill:impact-analysis',
    'skill:create-delete-plan',
    'skill:check-stale-refs',
    // skill V5.2 usage/health/tree
    'skill:usage-statuses',
    'skill:health-scores',
    'skill:usage-tree',
    'skill:config-files',
    'skill:generate-readme',
    'skill:toggle-safe',
    'skill:loader-order',
    'skill:export-package',
    'skill:find-unused',
    // skill profile V5.5+
    'skill-profile:create-apply-plan',
    'skill-profile:execute-apply-plan',
    // skillMeta V5.0
    'skillMeta:getAll',
    'skillMeta:get',
    'skillMeta:save',
    'skillMeta:analyze',
    'skillMeta:analyzeAll',
    'skillMeta:clearAuto',
    // history V4.0
    'history:load',
    'history:get-last',
    'history:undo',
    'history:add',
    'history:clear',
    // import V4.0
    'import:open-dialog',
    'import:parse-file',
    'import:compute-conflicts',
    'import:execute',
    // favorite
    'favorite:toggle',
    'favorite:load',
    'favorite:get-bindings',
  ];

  return knownHandlers.map((channel) => ({
    channel,
    registered: ipcMain.listenerCount(channel) > 0,
  }));
}

export function registerAppIpc(): void {
  ipcMain.handle('app:getRuntimeInfo', async (): Promise<RuntimeInfo> => {
    let appVersion = '0.1.0';
    try {
      const pkgPath = path.join(app.getAppPath(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const raw = fs.readFileSync(pkgPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version) appVersion = parsed.version;
      }
    } catch {
      // 使用默认版本
    }

    const handlers = collectRegisteredHandlers();

    return {
      appVersion,
      mainBuildTime: MAIN_START_TIME,
      preloadBuildTime: '', // 由 preload 自行填充
      rendererBuildTime: '', // 由 renderer 自行填充
      registeredIpcHandlers: handlers,
      preloadApiVersion: '5.4.0',
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
    };
  });
}
