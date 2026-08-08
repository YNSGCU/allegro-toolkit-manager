/**
 * ATM - 设置备份与恢复模块（V5.7）
 *
 * 将软件设置打包为单个 .atmbak 文件（JSON 格式），用于跨电脑 / 下一块板子复用：
 *  - pcbenv 级：快捷键方案、Skill 方案、菜单方案、收藏、命令来源修正、
 *    Skill 元数据、已应用状态、多 env 来源设置
 *  - 应用级：配色方案、环境注册表（可选）、更新源配置（可选）
 *  - 界面偏好：渲染进程 localStorage 中的 UI 设置（由渲染进程收集并写回）
 *
 * 纯 TypeScript 模块，可通过 Vitest 测试。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadSettings } from '../settings/atmSettings';
import { loadAllProfiles } from '../profile/hotkeyProfile';
import { loadMenuProfileStore, getMenuProfilePath } from '../menu/menuManager';
import { loadSkillProfileStore, getSkillProfilePath } from '../skill/skillProfileManager';
import { loadFavorites, getFavoritesPath } from '../dictionary/hotkeyFavorites';
import { loadUserOverrides, getOverrideFilePath } from '../dictionary/userCommandOverrides';
import { loadAllSkillMeta } from '../skill/skillMeta';
import { loadColorSchemeStore, getColorSchemeStorePath } from '../color/colorSchemeManager';
import { loadWorkspaceStore, getWorkspaceStorePath } from '../workspace/workspaceManager';
import { getWindowStatePath, loadWindowState } from '../settings/windowState';
import { loadEnvironmentRegistry, saveEnvironmentRegistry, getEnvironmentRegistryPath } from '../environment/environmentRegistry';
import { locateEnvironment } from '../environment/locateEnvironment';
import { addChangeRecord } from '../changeHistory/changeHistory';
import type {
  AtmBackupFile,
  BackupAppSection,
  BackupPcbenvSection,
  BackupRestoreOptions,
  BackupRestoreResult,
  BackupSectionDetail,
  BackupSectionId,
  BackupSummary,
  BackupSummarySection,
  CreateBackupOptions,
} from '../../src/types/backup';

// ════════════════════════════════════════════════════════════
// 路径辅助
// ════════════════════════════════════════════════════════════

function atmGeneratedDir(pcbenvPath: string): string {
  return path.join(pcbenvPath, 'atm_generated');
}

function settingsDir(pcbenvPath: string): string {
  return path.join(atmGeneratedDir(pcbenvPath), 'settings');
}

function settingsFilePath(pcbenvPath: string, fileName: string): string {
  return path.join(settingsDir(pcbenvPath), fileName);
}

function skillMetaFilePath(pcbenvPath: string): string {
  return path.join(pcbenvPath, 'atm_data', 'skill_metadata.json');
}

function readJsonIfExists<T>(filePath: string): T | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return undefined;
  }
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// ════════════════════════════════════════════════════════════
// 数据收集
// ════════════════════════════════════════════════════════════

/** 收集 pcbenv 级配置（仅收集实际存在的文件，避免写入无意义默认值） */
export function collectPcbenvSection(pcbenvPath: string): BackupPcbenvSection {
  const section: BackupPcbenvSection = {};
  if (!pcbenvPath || !fs.existsSync(pcbenvPath)) return section;

  const atmSettingsPath = settingsFilePath(pcbenvPath, 'atm_settings.json');
  if (fs.existsSync(atmSettingsPath)) {
    section.atmSettings = loadSettings(pcbenvPath);
  }

  const appliedPath = settingsFilePath(pcbenvPath, 'applied_profile.json');
  const applied = readJsonIfExists<{ profileId?: string; appliedAt?: string }>(appliedPath);
  if (applied) {
    section.appliedProfiles = {
      hotkeyProfileId: applied.profileId,
      appliedAt: applied.appliedAt,
    };
  }

  const favoritesPath = getFavoritesPath(pcbenvPath);
  if (fs.existsSync(favoritesPath)) {
    section.hotkeyFavorites = loadFavorites(pcbenvPath);
  }

  const profiles = loadAllProfiles(pcbenvPath);
  if (profiles.length > 0) {
    section.hotkeyProfiles = profiles;
  }

  const menuPath = getMenuProfilePath(atmGeneratedDir(pcbenvPath));
  if (fs.existsSync(menuPath)) {
    section.menuProfileStore = loadMenuProfileStore(atmGeneratedDir(pcbenvPath));
  }

  const skillProfilePath = getSkillProfilePath(atmGeneratedDir(pcbenvPath));
  if (fs.existsSync(skillProfilePath)) {
    section.skillProfileStore = loadSkillProfileStore(atmGeneratedDir(pcbenvPath));
  }

  const overridePath = getOverrideFilePath(pcbenvPath);
  if (fs.existsSync(overridePath)) {
    const overrides = loadUserOverrides(overridePath);
    if (Object.keys(overrides).length > 0) {
      section.userCommandOverrides = { version: '1.0', overrides };
    }
  }

  const metaPath = skillMetaFilePath(pcbenvPath);
  if (fs.existsSync(metaPath)) {
    const metas = loadAllSkillMeta(pcbenvPath);
    if (Object.keys(metas).length > 0) {
      section.skillMetadata = metas;
    }
  }

  return section;
}

/** 收集应用级配置 */
export function collectAppSection(options: Pick<CreateBackupOptions, 'updateSettings'> = {}): BackupAppSection {
  const section: BackupAppSection = {};

  const colorStore = loadColorSchemeStore();
  if (colorStore.schemes.length > 0) {
    section.colorSchemes = colorStore;
  }

  const windowState = loadWindowState();
  if (windowState) {
    section.windowState = windowState;
  }

  const workspaces = loadWorkspaceStore();
  // 默认工作区是系统初始状态，无需迁移；仅备份用户创建的工作区
  if (workspaces.workspaces.length > 1) {
    section.workspaces = workspaces;
  }

  const registry = loadEnvironmentRegistry();
  if (registry.environments.length > 0 || (registry.manualInstallRoots?.length ?? 0) > 0) {
    section.environments = registry;
  }

  if (options.updateSettings && Object.keys(options.updateSettings).length > 0) {
    section.updateSettings = options.updateSettings;
  }

  return section;
}

/** 收集当前激活环境的全部可备份数据并组装备份文件 */
export function createBackupFile(pcbenvPath: string, options: CreateBackupOptions = {}): AtmBackupFile {
  let allegroVersion: string | null = null;
  let environmentName: string | undefined;
  try {
    const envInfo = locateEnvironment();
    allegroVersion = envInfo.allegroVersion ?? null;
    environmentName = envInfo.environmentId;
  } catch {
    // 环境定位失败不影响备份本身
  }

  const backup: AtmBackupFile = {
    format: 'atm-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    source: {
      pcbenvPath: pcbenvPath || undefined,
      machineName: os.hostname(),
      platform: process.platform,
      appVersion: options.appVersion || 'unknown',
      allegroVersion,
      environmentName,
    },
    sections: {},
  };

  const pcbenvSection = collectPcbenvSection(pcbenvPath || '');
  if (Object.keys(pcbenvSection).length > 0) {
    backup.sections.pcbenv = pcbenvSection;
  }

  const appSection = collectAppSection({ updateSettings: options.updateSettings });
  if (Object.keys(appSection).length > 0) {
    backup.sections.app = appSection;
  }

  if (options.uiPreferences && Object.keys(options.uiPreferences).length > 0) {
    backup.sections.ui = { preferences: options.uiPreferences };
  }

  return backup;
}

// ════════════════════════════════════════════════════════════
// 序列化 / 解析 / 摘要
// ════════════════════════════════════════════════════════════

/** 序列化备份文件为 JSON 字符串 */
export function serializeBackupFile(backup: AtmBackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** 解析并校验备份文件内容；格式无效时抛出中文错误 */
export function parseBackupFile(jsonStr: string): AtmBackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('备份文件不是有效的 JSON，可能已损坏。');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('备份文件内容为空或结构无效。');
  }

  const backup = parsed as Partial<AtmBackupFile>;
  if (backup.format !== 'atm-backup') {
    throw new Error('不是 ATM 备份文件（缺少 atm-backup 格式标识）。');
  }
  if (backup.version !== 1) {
    throw new Error(`不支持此备份文件版本（${String(backup.version)}），请升级软件后再试。`);
  }
  if (!backup.sections || typeof backup.sections !== 'object') {
    throw new Error('备份文件缺少配置分区。');
  }
  return backup as AtmBackupFile;
}

function countObjectKeys(value: unknown): number {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return Array.isArray(value) ? value.length : 0;
}

/** 生成备份摘要（用于恢复前预览） */
export function summarizeBackup(backup: AtmBackupFile): BackupSummary {
  const sections: BackupSummarySection[] = [];
  const pcbenv = backup.sections.pcbenv;
  if (pcbenv) {
    const details: BackupSectionDetail[] = [];
    if (pcbenv.hotkeyProfiles?.length) details.push({ key: 'hotkeyProfiles', label: '快捷键方案', count: pcbenv.hotkeyProfiles.length });
    if (pcbenv.menuProfileStore) details.push({ key: 'menuProfileStore', label: '菜单方案', count: pcbenv.menuProfileStore.profiles?.length });
    if (pcbenv.skillProfileStore) details.push({ key: 'skillProfileStore', label: 'Skill 方案', count: pcbenv.skillProfileStore.profiles?.length });
    if (pcbenv.hotkeyFavorites?.favoriteBindingIds?.length) details.push({ key: 'hotkeyFavorites', label: '快捷键收藏', count: pcbenv.hotkeyFavorites.favoriteBindingIds.length });
    if (pcbenv.userCommandOverrides) details.push({ key: 'userCommandOverrides', label: '命令来源修正', count: countObjectKeys(pcbenv.userCommandOverrides.overrides) });
    if (pcbenv.skillMetadata) details.push({ key: 'skillMetadata', label: 'Skill 元数据', count: countObjectKeys(pcbenv.skillMetadata) });
    if (pcbenv.atmSettings) details.push({ key: 'atmSettings', label: '多 env 来源设置', count: (pcbenv.atmSettings.referenceEnvPaths?.length ?? 0) + 1 });
    if (pcbenv.appliedProfiles) details.push({ key: 'appliedProfiles', label: '已应用方案状态' });
    if (details.length > 0) {
      sections.push({ id: 'pcbenv', label: '板子配置（快捷键 / Skill / 菜单）', details });
    }
  }

  const app = backup.sections.app;
  if (app) {
    const details: BackupSectionDetail[] = [];
    if (app.colorSchemes) details.push({ key: 'colorSchemes', label: '配色方案', count: app.colorSchemes.schemes?.length });
    if (app.windowState) details.push({ key: 'windowState', label: '窗口大小与位置', hint: app.windowState.isMaximized ? '最大化' : undefined });
    if (app.environments) details.push({ key: 'environments', label: '环境注册表', count: app.environments.environments?.length });
    if (app.updateSettings) details.push({ key: 'updateSettings', label: '更新源配置' });
    if (details.length > 0) {
      sections.push({ id: 'app', label: '应用级配置（跨板子全局）', details });
    }
  }

  const ui = backup.sections.ui;
  if (ui?.preferences) {
    const keys = Object.keys(ui.preferences);
    sections.push({
      id: 'ui',
      label: '界面偏好',
      details: keys.length > 0
        ? [{ key: 'uiPreferences', label: '界面设置项', count: keys.length, hint: keys.slice(0, 5).join('、') }]
        : [],
    });
  }

  const totalItems = sections.reduce(
    (sum, section) => sum + section.details.reduce((s, d) => s + (d.count ?? 1), 0),
    0,
  );

  return {
    createdAt: backup.createdAt || '',
    source: {
      pcbenvPath: backup.source?.pcbenvPath,
      machineName: backup.source?.machineName || '未知电脑',
      platform: backup.source?.platform || 'unknown',
      appVersion: backup.source?.appVersion || 'unknown',
      allegroVersion: backup.source?.allegroVersion ?? null,
      environmentName: backup.source?.environmentName,
    },
    sections,
    totalItems,
  };
}

// ════════════════════════════════════════════════════════════
// 恢复
// ════════════════════════════════════════════════════════════

interface PendingWrite {
  target: string;
  data: unknown;
}

/** 计算恢复前要覆盖的现有文件，并规划写入 */
function buildRestorePlan(
  pcbenvPath: string,
  backup: AtmBackupFile,
  options: BackupRestoreOptions,
): { writes: PendingWrite[]; targetFiles: string[] } {
  const writes: PendingWrite[] = [];
  const targetFiles: string[] = [];
  const selected = new Set<BackupSectionId>(options.sections || ['pcbenv', 'app', 'ui']);
  const atmDir = atmGeneratedDir(pcbenvPath);

  const push = (target: string, data: unknown) => {
    writes.push({ target, data });
    targetFiles.push(target);
  };

  if (selected.has('pcbenv') && backup.sections.pcbenv) {
    const pcbenv = backup.sections.pcbenv;
    if (pcbenv.atmSettings) {
      push(settingsFilePath(pcbenvPath, 'atm_settings.json'), pcbenv.atmSettings);
    }
    if (pcbenv.appliedProfiles) {
      push(settingsFilePath(pcbenvPath, 'applied_profile.json'), {
        profileId: pcbenv.appliedProfiles.hotkeyProfileId || '',
        appliedAt: pcbenv.appliedProfiles.appliedAt || new Date().toISOString(),
      });
    }
    if (pcbenv.hotkeyFavorites) {
      push(getFavoritesPath(pcbenvPath), pcbenv.hotkeyFavorites);
    }
    for (const profile of pcbenv.hotkeyProfiles || []) {
      push(path.join(atmDir, 'profiles', `${profile.id}.profile.json`), profile);
    }
    if (pcbenv.menuProfileStore) {
      push(getMenuProfilePath(atmDir), pcbenv.menuProfileStore);
    }
    if (pcbenv.skillProfileStore) {
      push(getSkillProfilePath(atmDir), pcbenv.skillProfileStore);
    }
    if (pcbenv.userCommandOverrides?.overrides) {
      push(getOverrideFilePath(pcbenvPath), pcbenv.userCommandOverrides);
    }
    if (pcbenv.skillMetadata) {
      push(skillMetaFilePath(pcbenvPath), pcbenv.skillMetadata);
    }
  }

  if (selected.has('app') && backup.sections.app) {
    const app = backup.sections.app;
    if (app.colorSchemes) {
      push(getColorSchemeStorePath(), app.colorSchemes);
    }
    if (app.windowState) {
      push(getWindowStatePath(), app.windowState);
    }
    if (app.workspaces) {
      push(getWorkspaceStorePath(), app.workspaces);
    }
    if (options.includeEnvironments && app.environments) {
      push(getEnvironmentRegistryPath(), app.environments);
    }
    if (options.includeUpdateSettings && app.updateSettings && options.appPaths?.updateSettingsPath) {
      push(options.appPaths.updateSettingsPath, app.updateSettings);
    }
  }

  return { writes, targetFiles };
}

/**
 * 执行恢复：
 *  1. 将将要覆盖的现有文件复制到 {pcbenvPath}/atm_generated/backups/pre-restore-<时间戳>/
 *  2. 原子写入所有规划文件
 *  3. 记录变更历史
 */
export function restoreBackupFile(
  pcbenvPath: string,
  backup: AtmBackupFile,
  options: BackupRestoreOptions = {},
): BackupRestoreResult {
  if (!pcbenvPath) {
    throw new Error('未找到可恢复的 pcbenv 目录，请先在环境页完成配置。');
  }

  const { writes, targetFiles } = buildRestorePlan(pcbenvPath, backup, options);
  if (writes.length === 0) {
    return { restoredSections: [], restoredFiles: [] };
  }

  // 1. 恢复前自动备份（保留现场以便回退）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const preRestoreDir = path.join(atmGeneratedDir(pcbenvPath), 'backups', `pre-restore-${timestamp}`);
  fs.mkdirSync(preRestoreDir, { recursive: true });

  for (const write of writes) {
    if (!fs.existsSync(write.target)) continue;
    // 目标文件可能位于 pcbenv 内或应用配置目录；统一使用相对结构存放
    const rel = relativeToBackupRoot(write.target, pcbenvPath);
    const dest = path.join(preRestoreDir, rel);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(write.target, dest);
    } catch {
      // 单个文件现场备份失败不阻断恢复，由写入阶段统一报告
    }
  }

  // 2. 原子写入；单文件失败不阻断其余文件，最终给出明确的部分成功信息
  const failedWrites: string[] = [];
  const writtenTargets: string[] = [];
  for (const write of writes) {
    try {
      writeJsonAtomic(write.target, write.data);
      writtenTargets.push(write.target);
    } catch {
      failedWrites.push(path.basename(write.target));
    }
  }
  if (failedWrites.length > 0) {
    // 3. 自动回滚：把 pre-restore 现场备份复制回原位，恢复恢复前状态
    let rolledBackCount = 0;
    for (const target of writtenTargets) {
      const rel = relativeToBackupRoot(target, pcbenvPath);
      const backupFile = path.join(preRestoreDir, rel);
      try {
        if (fs.existsSync(backupFile)) {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(backupFile, target);
        } else {
          // 原文件不存在，回滚即删除本次写入的产物
          fs.rmSync(target, { force: true });
        }
        rolledBackCount += 1;
      } catch {
        // 单个文件回滚失败时保留 pre-restore 目录供手动回退
      }
    }
    throw new Error(
      `部分文件写入失败（成功 ${writes.length - failedWrites.length}/${writes.length}），` +
      `已自动回滚 ${rolledBackCount} 个文件，失败文件：${failedWrites.join('、')}。` +
      `回退备份位于 ${preRestoreDir}，如需手工核对可查看该目录。`
    );
  }
  // 4. 记录变更历史
  try {
    addChangeRecord(pcbenvPath, {
      operation: 'restore',
      summary: `恢复设置备份（${backup.createdAt}）`,
      targetFile: 'atm_generated (backup restore)',
      backupFile: preRestoreDir,
      backupId: `pre-restore-${timestamp}`,
      stepsCount: writes.length,
      planId: 'backup-restore',
      undoable: false,
    });
  } catch {
    // 历史记录失败不阻断恢复
  }

  const restoredSections = Array.from(new Set<BackupSectionId>(options.sections || ['pcbenv', 'app', 'ui']))
    .filter((id) => Boolean(backup.sections[id]));

  return {
    restoredSections,
    restoredFiles: targetFiles,
    preRestoreBackupDir: preRestoreDir,
    uiPreferences: backup.sections.ui?.preferences,
  };
}

/** 计算文件相对备份根目录的路径（pcbenv 内文件去掉 pcbenv 前缀；应用级文件放入 app/） */
function relativeToBackupRoot(target: string, pcbenvPath: string): string {
  const normalizedTarget = path.normalize(target).toLowerCase();
  const normalizedPcbenv = path.normalize(pcbenvPath).toLowerCase();
  if (normalizedTarget.startsWith(normalizedPcbenv + path.sep)) {
    return path.relative(pcbenvPath, target);
  }
  return path.join('app', path.basename(target));
}
