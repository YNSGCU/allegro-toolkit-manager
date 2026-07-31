/**
 * ATM - Apply Plan 统一类型体系（V5.3）
 *
 * 所有写文件操作必须走 Apply Plan：
 * - 快捷键编辑/新增/删除/导入
 * - Skill 启用/禁用/删除/加载器
 * - 菜单编辑/生成
 * - 同步/备份/恢复
 */

// ═══════════════════════════════════════════════════
// ApplyPlan 核心结构
// ═══════════════════════════════════════════════════

export type ApplyPlanModule = 'hotkey' | 'skill' | 'menu' | 'sync' | 'environment';

export type ApplyPlanStatus = 'draft' | 'ready' | 'applying' | 'applied' | 'failed' | 'cancelled';

export interface ApplyPlan {
  id: string;
  title: string;
  description?: string;
  module: ApplyPlanModule;
  createdAt: string;
  steps: ApplyPlanStep[];
  risks: ApplyPlanRisk[];
  backups: ApplyPlanBackup[];
  requiresRestart?: boolean;
  targetFiles: string[];
  status: ApplyPlanStatus;
  /** 兼容旧版 summary 字段 */
  summary?: string;
  /** 兼容旧版 warnings 字段 */
  warnings?: { level: 'info' | 'warning' | 'danger'; message: string }[];
}

// ═══════════════════════════════════════════════════
// ApplyPlanStep
// ═══════════════════════════════════════════════════

export type ApplyPlanStepType =
  | 'backup_file'
  | 'modify_line'
  | 'append_line'
  | 'comment_line'
  | 'write_file'
  | 'create_file'
  | 'delete_file'
  | 'archive_file'
  | 'update_json'
  | 'generate_loader'
  | 'generate_menu'
  | 'ensure_bootstrap'
  | 'record_history'
  | 'create_directory'
  | 'move_file'
  // 兼容旧版 step type
  | 'backup'
  | 'write_skill_loader'
  | 'write_bootstrap'
  | 'modify_ilinit';

export interface ApplyPlanStep {
  id: string;
  type: ApplyPlanStepType;
  /** 中文标题（直接显示给用户） */
  title: string;
  /** 详细描述 */
  description?: string;
  /** 目标文件路径 */
  targetFile?: string;
  /** 行号 */
  lineNumber?: number;
  /** 修改前内容 */
  before?: string;
  /** 修改后内容 */
  after?: string;
  /** 预览文本 */
  previewText?: string;
  /** 执行状态 */
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  /** 兼容旧版 target 字段 */
  target?: string;
  /** 兼容旧版 backupTo 字段 */
  backupTo?: string;
}

// ═══════════════════════════════════════════════════
// ApplyPlanRisk
// ═══════════════════════════════════════════════════

export interface ApplyPlanRisk {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  suggestedAction?: string;
}

// ═══════════════════════════════════════════════════
// ApplyPlanBackup
// ═══════════════════════════════════════════════════

export interface ApplyPlanBackup {
  sourceFile: string;
  backupFile: string;
  required: boolean;
}

// ═══════════════════════════════════════════════════
// ApplyResult
// ═══════════════════════════════════════════════════

export interface ApplyResult {
  success: boolean;
  planId: string;
  appliedSteps: number;
  totalSteps: number;
  error?: string;
  rollbackPath?: string;
}

// ═══════════════════════════════════════════════════
// ChangeHistory（V5.3 统一）
// ═══════════════════════════════════════════════════

export interface ChangeHistoryItem {
  id: string;
  appliedAt: string;
  title: string;
  module: ApplyPlanModule;
  planId: string;
  targetFiles: string[];
  steps: ApplyPlanStep[];
  backups: ApplyPlanBackup[];
  canUndo: boolean;
  /** 指向 backups 中的文件路径，供撤销恢复 */
  primaryBackup?: string;
}

// ═══════════════════════════════════════════════════
// Step Type → 中文映射
// ═══════════════════════════════════════════════════

/** 所有 ApplyPlanStepType 的中文映射 */
export const STEP_TYPE_CHINESE: Record<string, string> = {
  backup_file: '备份文件',
  modify_line: '修改指定行',
  append_line: '追加新行',
  comment_line: '注释原行',
  write_file: '写入文件',
  create_file: '创建文件',
  delete_file: '删除文件',
  archive_file: '归档文件',
  update_json: '更新配置文件',
  generate_loader: '生成 Skill 加载器',
  generate_menu: '生成菜单注入脚本',
  ensure_bootstrap: '确保 ATM 启动脚本已加载',
  record_history: '记录变更历史',
  create_directory: '创建目录',
  move_file: '移动文件',
  // 兼容旧版
  backup: '备份文件',
  write_skill_loader: '更新 Skill 加载器',
  write_bootstrap: '写入 ATM 启动脚本',
  modify_ilinit: '确保 allegro.ilinit 加载 ATM bootstrap',
};

/** 获取步骤类型的中文显示 */
export function getStepTypeChinese(type: string): string {
  return STEP_TYPE_CHINESE[type] || type;
}

// ═══════════════════════════════════════════════════
// 来源类型（统一托管标签）
// ═══════════════════════════════════════════════════

/** 快捷键来源 */
export type HotkeyBindingSource =
  | 'user_env_original'
  | 'atm_managed_block'
  | 'active_profile'
  | 'imported_profile'
  | 'install_default_env'
  | 'site_env'
  | 'company_env'
  | 'allegro_default'
  | 'system_reserved'
  | 'unknown';

/** Skill 来源 */
export type SkillSourceTypeV53 =
  | 'user_skill'
  | 'atm_managed_skill'
  | 'company_skill'
  | 'readonly_skill'
  | 'unknown';

/** 菜单来源 */
export type MenuSource =
  | 'atm_managed'
  | 'skill_package'
  | 'imported'
  | 'manual'
  | 'allegro_default'
  | 'company_menu'
  | 'unknown';

/** 托管来源中文标签 */
export const SOURCE_LABELS: Record<string, { label: string; badge: string; readOnly: boolean }> = {
  // 快捷键
  user_env_original: { label: '用户原始配置', badge: '原始', readOnly: false },
  atm_managed_block: { label: 'ATM 托管块', badge: '托管', readOnly: false },
  active_profile: { label: '当前快捷键方案', badge: '方案', readOnly: false },
  imported_profile: { label: '导入方案', badge: '导入', readOnly: false },
  install_default_env: { label: '安装默认 env', badge: '默认', readOnly: true },
  site_env: { label: '站点 env', badge: '站点', readOnly: true },
  company_env: { label: '公司 env', badge: '公司', readOnly: true },
  allegro_default: { label: 'Allegro 默认', badge: '默认', readOnly: true },
  system_reserved: { label: '系统保留', badge: '系统', readOnly: true },
  // Skill
  user_skill: { label: '用户 Skill', badge: '用户', readOnly: false },
  atm_managed_skill: { label: 'ATM 托管 Skill', badge: '托管', readOnly: false },
  company_skill: { label: '公司 Skill', badge: '公司', readOnly: true },
  readonly_skill: { label: '只读 Skill', badge: '只读', readOnly: true },
  // 菜单
  atm_managed: { label: 'ATM 托管菜单', badge: '托管', readOnly: false },
  skill_package: { label: 'Skill 包菜单', badge: '包', readOnly: false },
  imported: { label: '导入菜单', badge: '导入', readOnly: false },
  manual: { label: '手动添加', badge: '手动', readOnly: false },
  company_menu: { label: '公司菜单', badge: '公司', readOnly: true },
  unknown: { label: '未知来源', badge: '未知', readOnly: false },
};

/** 获取来源的中文显示标签 */
export function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source]?.label || source;
}

/** 获取来源的中文徽章 */
export function getSourceBadge(source: string): string {
  return SOURCE_LABELS[source]?.badge || source;
}

/** 来源是否只读 */
export function isSourceReadOnly(source: string): boolean {
  return SOURCE_LABELS[source]?.readOnly ?? false;
}
