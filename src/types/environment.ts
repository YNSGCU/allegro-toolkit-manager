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
  /** ATM 环境工作区标识（多版本管理） */
  environmentId?: string;
  /** Allegro 版本，例如 17.4、23.1 */
  allegroVersion?: string | null;
  /** Allegro 安装根目录 */
  installRoot?: string | null;
  /** Allegro 可执行文件路径（如果能定位） */
  executablePath?: string | null;
  /** 与当前工作区共享同一个 pcbenv 的其他版本 */
  sharedEnvironmentIds?: string[];
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

/** 一个可被 ATM 选择、扫描和写入的 Allegro 工作区。 */
export interface AllegroEnvironmentWorkspace {
  id: string;
  name: string;
  allegroVersion: string | null;
  installRoot: string | null;
  executablePath: string | null;
  homePath: string | null;
  pcbenvPath: string;
  envFilePath: string;
  ilinitFilePath: string;
  writable: boolean;
  exists: boolean;
  sharedWithIds: string[];
  source: 'discovered' | 'manual' | 'imported';
  lastVerifiedAt?: string;
}

export interface EnvironmentRegistry {
  version: number;
  activeEnvironmentId: string | null;
  environments: AllegroEnvironmentWorkspace[];
  /** ATM 进程从 Windows 继承的默认环境，仅用于提示桌面启动可能加载哪套配置。 */
  hostEnvironment?: {
    homePath: string | null;
    cdsRoot: string | null;
  };
  /** 手动指定的 Allegro 安装根目录（SPB_xx.x 级别），用于新电脑上自动扫描找不到时的补充 */
  manualInstallRoots?: string[];
  updatedAt: string;
}

export type CompatibilitySeverity = 'info' | 'warning' | 'error';

export interface CompatibilityFinding {
  severity: CompatibilitySeverity;
  code: string;
  title: string;
  description: string;
}

export interface ProfileCompatibilityReport {
  sourceVersion: string | null;
  targetVersion: string | null;
  verdict: 'portable' | 'warning' | 'blocked';
  findings: CompatibilityFinding[];
}

export interface ProfileCompatibilityMetadata {
  intendedEnvironmentId?: string | null;
  intendedAllegroVersion?: string | null;
  lastCheckedAt?: string;
  lastVerdict?: ProfileCompatibilityReport['verdict'];
}

export interface CompatibilityEvidenceRecord {
  id: string;
  environmentId: string;
  allegroVersion: string | null;
  scope: 'environment' | 'hotkey' | 'skill' | 'menu';
  subjectId: string;
  subjectType: 'environment' | 'profile' | 'command' | 'skill' | 'menu';
  status: 'unverified' | 'static_pass' | 'runtime_pass' | 'warning' | 'blocked';
  evidenceSource: 'static' | 'vibe_bridge' | 'manual';
  summary: string;
  details?: string;
  checkedAt: string;
}

export interface AllegroRuntimeVerificationResult {
  connected: boolean;
  matchedEnvironment: boolean;
  expectedVersion: string | null;
  actualVersion: string | null;
  fullVersion: string | null;
  programName: string | null;
  bridgeWorkspace: string | null;
  status: 'runtime_pass' | 'warning' | 'unverified';
  message: string;
}
