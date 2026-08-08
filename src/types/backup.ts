/**
 * ATM - 备份与恢复类型定义（V5.7）
 *
 * 将软件设置（快捷键/Skill/菜单方案、收藏、命令来源修正、配色方案、
 * 已应用状态、界面偏好等）打包为单个 .atmbak 文件，
 * 用于跨电脑 / 下一块板子迁移复用。
 */
import type { AtmSettings, EnvironmentRegistry } from './environment';
import type { HotkeyProfile } from './hotkey';
import type { MenuProfileStore } from './menu';
import type { SkillProfileStore } from './skillProfile';
import type { ColorSchemeStore } from './color';

/** 备份文件格式标识 */
export const BACKUP_FORMAT = 'atm-backup';

/** 备份文件格式版本 */
export const BACKUP_VERSION = 1;

/** 备份来源信息 */
export interface BackupSourceInfo {
  /** 来源 pcbenv 目录（仅参考，不用于恢复定位） */
  pcbenvPath?: string;
  machineName: string;
  platform: string;
  appVersion: string;
  allegroVersion?: string | null;
  environmentName?: string;
}

/** 快捷键收藏（最小结构，避免依赖 core 内部类型） */
export interface BackupHotkeyFavorites {
  version?: number;
  favoriteBindingIds?: string[];
  updatedAt?: string;
}

/** 用户命令来源修正（最小结构） */
export interface BackupCommandOverrides {
  version?: string;
  overrides?: Record<string, unknown>;
}

/** pcbenv 级配置（恢复时写入当前激活环境的 atm_generated/ 与 atm_data/） */
export interface BackupPcbenvSection {
  /** 多 env 来源设置（activeUserEnvPath / referenceEnvPaths） */
  atmSettings?: AtmSettings;
  /** 已应用方案追踪 */
  appliedProfiles?: {
    hotkeyProfileId?: string;
    appliedAt?: string;
  };
  /** 快捷键收藏 */
  hotkeyFavorites?: BackupHotkeyFavorites;
  /** 快捷键方案列表 */
  hotkeyProfiles?: HotkeyProfile[];
  /** 菜单方案存储（含 activeProfileId / appliedProfileId） */
  menuProfileStore?: MenuProfileStore;
  /** Skill 方案存储 */
  skillProfileStore?: SkillProfileStore;
  /** 用户命令来源修正记录 */
  userCommandOverrides?: BackupCommandOverrides;
  /** Skill 中文备注等元数据 */
  skillMetadata?: Record<string, unknown>;
}

/** 应用级配置（跨板子全局资源） */
export interface BackupAppSection {
  /** 配色方案存储 */
  colorSchemes?: ColorSchemeStore;
  /** 主窗口大小/位置/最大化状态 */
  windowState?: BackupWindowState;
  /** Allegro 环境注册表（路径随电脑变化，默认不恢复） */
  environments?: EnvironmentRegistry;
  /** 更新源配置（默认不恢复） */
  updateSettings?: Record<string, unknown>;
}

/** 窗口状态（跨板子全局资源，新电脑同样适用） */
export interface BackupWindowState {
  version?: number;
  bounds?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  isMaximized?: boolean;
  updatedAt?: string;
}

/** 界面偏好（渲染进程 localStorage，如冲突忽略列表） */
export interface BackupUiSection {
  preferences?: Record<string, string>;
}

export type BackupSectionId = 'pcbenv' | 'app' | 'ui';

/** 备份文件整体结构 */
export interface AtmBackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  source: BackupSourceInfo;
  sections: {
    pcbenv?: BackupPcbenvSection;
    app?: BackupAppSection;
    ui?: BackupUiSection;
  };
}

/** 恢复选项 */
export interface BackupRestoreOptions {
  /** 要恢复的分区；缺省恢复所有存在分区 */
  sections?: BackupSectionId[];
  /** 是否恢复环境注册表（默认 false：新电脑路径不同，建议重新扫描） */
  includeEnvironments?: boolean;
  /** 是否恢复更新源配置（默认 false） */
  includeUpdateSettings?: boolean;
  /** 应用级文件路径（由 Electron 主进程提供） */
  appPaths?: {
    /** userData 目录下 update-settings.json 的完整路径 */
    updateSettingsPath?: string;
  };
}

/** 备份摘要中的单个条目 */
export interface BackupSectionDetail {
  key: string;
  label: string;
  count?: number;
  hint?: string;
}

/** 备份摘要分区 */
export interface BackupSummarySection {
  id: BackupSectionId;
  label: string;
  details: BackupSectionDetail[];
}

/** 备份摘要（用于恢复前预览） */
export interface BackupSummary {
  createdAt: string;
  source: BackupSourceInfo;
  sections: BackupSummarySection[];
  totalItems: number;
}

/** 恢复执行结果 */
export interface BackupRestoreResult {
  restoredSections: BackupSectionId[];
  restoredFiles: string[];
  /** 恢复前自动备份目录（如需回退可手动查看） */
  preRestoreBackupDir?: string;
  /** 需要写回渲染进程 localStorage 的界面偏好 */
  uiPreferences?: Record<string, string>;
}

/** 创建备份选项 */
export interface CreateBackupOptions {
  appVersion?: string;
  /** 渲染进程收集的界面偏好（localStorage 键值） */
  uiPreferences?: Record<string, string>;
  /** 更新源配置（来自 userData/update-settings.json） */
  updateSettings?: Record<string, unknown>;
}
