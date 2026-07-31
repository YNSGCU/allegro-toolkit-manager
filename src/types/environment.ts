/**
 * ATM - Allegro Toolkit Manager
 * 环境检测相关类型定义
 */

/** 文件访问状态 */
export interface FileStatus {
  exists: boolean;
  readable: boolean;
  writable: boolean;
  path: string;
  error?: string;
}

/** 环境检测结果 */
export interface EnvironmentInfo {
  homePath: string | null;
  pcbenvPath: string | null;
  envFilePath: string | null;
  ilinitFilePath: string | null;
  atmGeneratedPath: string | null;

  envExists: boolean;
  envReadable: boolean;
  envWritable: boolean;
  ilinitExists: boolean;
  ilinitReadable: boolean;
  ilinitWritable: boolean;
  pcbenvExists: boolean;
  pcbenvWritable: boolean;

  detectedMode: 'local' | 'cloud_install_user_config' | 'unknown';
  warnings: string[];
}

/** 环境健康评分 */
export interface HealthScore {
  score: number;
  level: 'safe' | 'warning' | 'danger';
  details: HealthScoreItem[];
}

export interface HealthScoreItem {
  reason: string;
  deduction: number;
  category: string;
}

/** pcbenv 检测结果 */
export interface PcbenvResult {
  path: string | null;
  exists: boolean;
  isValid: boolean;
  warnings: string[];
}

/** 备份结果 */
export interface BackupResult {
  backupId: string;
  backupDir: string;
  files: BackupFileEntry[];
  success: boolean;
  error?: string;
}

export interface BackupFileEntry {
  originalPath: string;
  backupPath: string;
  sha256: string;
  size: number;
}

/** 回滚 manifest */
export interface RollbackManifest {
  backupId: string;
  createdAt: string;
  reason: string;
  files: {
    originalPath: string;
    backupPath: string;
    sha256: string;
  }[];
}

// ═══════════════════════════════════════════════
// V3.0 多 env 来源支持
// ═══════════════════════════════════════════════

/** env 文件角色 */
export type EnvRole =
  | 'user_env'            // 用户个人 env（可编辑）
  | 'install_default_env' // Allegro 安装默认 env（只读参考）
  | 'site_env'            // 站点级 env（只读参考）
  | 'company_env'         // 公司统一配置 env（只读参考）
  | 'reference_env'       // 用户手动添加的参考 env（只读）
  | 'unknown';            // 无法判断来源

/** 单个 env 来源描述 */
export interface EnvSource {
  id: string;
  path: string;
  role: EnvRole;
  readable: boolean;
  writable: boolean;
  exists: boolean;
  /** 优先级（数值越小优先级越高） */
  priority: number;
  hotkeyCount?: number;
  lastModified?: string;
  /** 是否为当前活动编辑 env */
  selectedAsActive: boolean;
  /** 是否为只读参考 env */
  isReference: boolean;
  /** 人类可读的显示名 */
  displayName: string;
}

/** env 来源列表 */
export interface EnvSourceList {
  sources: EnvSource[];
  activeEnvId: string | null;
  activeEnvPath: string | null;
}

/** ATM 设置 */
export interface AtmSettings {
  version: number;
  activeUserEnvPath: string | null;
  referenceEnvPaths: string[];
  lastScanTime?: string;
}
