/**
 * ATM - Allegro Toolkit Manager
 * Skill 管理相关类型定义（V4.5 增强版）
 */

// ═══════════════════════════════════════════════════
// 基础类型
// ═══════════════════════════════════════════════════

/** Skill 来源层级 */
export type SkillTier = 'company' | 'user' | 'atm';

/** Skill 包类型 */
export type SkillPackageType = 'single_file' | 'directory_package' | 'atm_package' | 'unknown';

/** Skill 来源类型 */
export type SkillSourceType = 'user_skill' | 'company_skill' | 'atm_managed_skill' | 'unknown';

/** Skill 启用状态 */
export type SkillStatus = 'enabled' | 'disabled';

/** Skill 加载状态 */
export type SkillLoadStatus =
  | 'loaded_configured'
  | 'enabled_but_not_loaded'
  | 'maybe_unloaded'       // 兼容旧版
  | 'disabled'
  | 'readonly_reference'
  | 'unknown';

/** Skill 解析状态 */
export type SkillParseStatus = 'ok' | 'warning' | 'error';

/** Skill 函数类型 */
export type SkillFunctionType = 'procedure' | 'defun' | 'defunValue';

/** 命令种类 */
export type SkillCommandKind = 'axl_registered' | 'procedure' | 'defun' | 'manual';

/** 识别置信度 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** 冲突状态 */
export type ConflictStatus = 'normal' | 'duplicate_command' | 'missing_load' | 'unknown';

/** 命令索引条目类型 */
export interface CommandIndexItem {
  commandName: string;
  normalizedCommandName: string;
  sourceType: SkillSourceType | 'allegro_builtin';
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceFile?: string;
  entryType: 'axlCmdRegister' | 'procedure' | 'defun' | 'manual';
  confidence: ConfidenceLevel;
  /** axlCmdRegister 的处理函数名（如 "ssnap_native_run"），commandName 为外部命令名（如 "snp"） */
  handlerFunction?: string;
}

// ═══════════════════════════════════════════════════
// 函数与命令定义
// ═══════════════════════════════════════════════════

/** Skill 中定义的函数 */
export interface SkillFunction {
  name: string;
  type: SkillFunctionType;
  lineNumber: number;
}

/** 增强 Skill 函数 — 区分入口/内部 */
export interface SkillFunctionItem {
  name: string;
  type: SkillFunctionType;
  lineNumber: number;
  isEntry: boolean;         // 是否为入口命令
  isAxlRegistered: boolean; // 是否通过 axlCmdRegister 注册
  confidence: ConfidenceLevel;
  reason: string;           // 判定依据描述
  /** axlCmdRegister 注册的外部命令名（如 "snp"），与 name（处理函数）不同 */
  commandName?: string;
  /** 当 isAxlRegistered=true 且命令名≠函数名时，记录实际处理函数名（如 "ssnap_native_run"） */
  handlerFunction?: string;
}

/** 命令注册中心 - 单个命令 */
export interface SkillCommandItem {
  id: string;
  name: string;
  zhName?: string;
  description?: string;
  sourceSkillId: string;
  sourceFile: string;
  sourceSkillName: string;
  commandKind: SkillCommandKind;
  isEntry: boolean;
  confidence: ConfidenceLevel;
  hotkeys: string[];
  menuPaths: string[];
  loadStatus: SkillLoadStatus;
  conflictStatus: ConflictStatus;
  tier: SkillTier;
  skillEnabled: boolean;
  /** axlCmdRegister 注册的原始处理函数名，当 name 为外部命令名时记录实际执行函数 */
  handlerFunction?: string;
}

// ═══════════════════════════════════════════════════
// 引用定义
// ═══════════════════════════════════════════════════

/** 快捷键引用 */
export interface HotkeyReference {
  key: string;
  command: string;
  type: 'funckey' | 'alias';
  source: string;   // env 文件路径
  lineNumber: number;
  sourceType?: 'env_binding' | 'skill_direct';
}

/** 菜单引用 */
export interface MenuReference {
  path: string;            // 例如 "Tools > ATM > Smart Snap"
  source: string;          // 来源文件
  command: string;         // 对应的命令
  isAtmGenerated: boolean; // 是否由 ATM 生成
}

// ═══════════════════════════════════════════════════
// 增强 Skill 文件项
// ═══════════════════════════════════════════════════

/** 增强 Skill 文件项 */
export interface SkillFileItem {
  id: string;
  name: string;
  path: string;
  dirPath: string;
  sourceType: SkillSourceType;
  tier: SkillTier;
  readonly: boolean;
  writable: boolean;
  enabled: boolean;
  loadStatus: SkillLoadStatus;
  fileSize?: number;
  lastModified?: string;
  parseStatus: SkillParseStatus;
  parseError?: string;
  packageType: SkillPackageType;
  hasPackageJson: boolean;
  /** 目录型 Skill 包含的全部源文件；单文件 Skill 可省略 */
  sourceFiles?: string[];
  dependencies: string[];
  totalFunctionCount: number;
  entryCommands: SkillCommandItem[];
  internalFunctions: SkillFunctionItem[];
  hotkeyRefs: HotkeyReference[];
  menuRefs: MenuReference[];
  /** 原始 scannedskill 的 functions（过渡用） */
  functions: SkillFunction[];
}

// ═══════════════════════════════════════════════════
// 兼容旧类型
// ═══════════════════════════════════════════════════

/** Skill 扫描结果 - 单个 Skill（旧版兼容） */
export interface ScannedSkill {
  id: string;
  name: string;
  filePath: string;
  dirPath: string;
  tier: SkillTier;
  status: SkillStatus;
  functions: SkillFunction[];
  hasPackageJson: boolean;
  /** 目录型 Skill 包含的全部源文件 */
  sourceFiles?: string[];
  dependencies: string[];
  error?: string;
}

/** Skill 解析结果 */
export interface SkillParseResult {
  filePath: string;
  functions: SkillFunction[];
  error?: string;
  /** V4.5 增强解析：增强函数列表 */
  enhancedFunctions?: SkillFunctionItem[];
  /** V5.3 axlCmdRegister 完整注册信息（命令名+处理函数映射） */
  axlRegistrations?: AxlCmdRegistration[];
  /** Skill 内部直接注册的快捷键/alias（如 axlSetFunckey / axlSetAlias） */
  directHotkeyRefs?: HotkeyReference[];
  /** 解析详情 */
  parseDetail?: {
    entryCount: number;
    internalCount: number;
    axlRegistered: string[];
    heuristicEntry: string[];
  };
}

/** axlCmdRegister 注册信息（与 parseSkillMeta.ts 的 AxlCmdRegistration 同步） */
export interface AxlCmdRegistration {
  commandName: string;
  handlerFunction?: string;
  lineNumber: number;
}

// ═══════════════════════════════════════════════════
// 命令注册中心
// ═══════════════════════════════════════════════════

/** 命令注册中心 - 单条命令记录（旧版兼容） */
export interface CommandEntry {
  commandName: string;
  type: SkillFunctionType | 'funckey' | 'alias';
  skillFilePath: string;
  skillName: string;
  tier: SkillTier;
  skillEnabled: boolean;
}

/** 命令注册中心 - V4.5 增强条目 */
export interface CommandRegistryEntry {
  commandName: string;
  entries: SkillCommandItem[];
}

/** 命令注册中心 */
export interface CommandRegistry {
  entries: Record<string, CommandEntry[]>;
  /** V4.5 增强命令列表 */
  commandList?: SkillCommandItem[];
  stats: {
    totalCommands: number;
    companyCommands: number;
    userCommands: number;
    atmCommands: number;
  };
}

// ═══════════════════════════════════════════════════
// 引用检查
// ═══════════════════════════════════════════════════

/** 引用检查问题类型 */
export type ReferenceIssueType =
  | 'hotkey_command_missing'
  | 'skill_not_loaded'
  | 'menu_command_missing'
  | 'duplicate_command'
  | 'skill_unreferenced'
  | 'parse_error'
  | 'skill_delete_has_refs'
  | 'duplicate_skill_command'
  | 'stale_hotkey_ref';

/** 引用检查问题 */
export interface SkillReferenceIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  type: ReferenceIssueType;
  title: string;
  description: string;
  skillId?: string;
  commandName?: string;
  hotkeyId?: string;
  hotkeyKey?: string;
  menuPath?: string;
  suggestedActions: string[];
  ignored?: boolean;
  /** 涉及的技能/命令详情 */
  details?: {
    matchedSkills?: string[];
    matchedCommands?: string[];
  };
}

/** 快捷键引用校验结果类型 */
export type RefCheckType =
  | 'resolved'
  | 'unresolved'
  | 'disabled_skill'
  | 'company_skill'
  | 'ambiguous';

/** 单条引用校验结果 */
export interface SkillRefCheck {
  command: string;
  type: RefCheckType;
  matches: CommandEntry[];
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** 引用校验结果集 */
export interface SkillRefValidationResult {
  checks: SkillRefCheck[];
  issues?: SkillReferenceIssue[];  // V4.5 增强问题列表
  stats: {
    resolved: number;
    unresolved: number;
    disabledSkill: number;
    companySkill: number;
    ambiguous: number;
  };
}

// ═══════════════════════════════════════════════════
// Apply Plan
// ═══════════════════════════════════════════════════

/** Skill Apply Plan 动作类型 */
export type SkillApplyStepType =
  | 'backup'
  | 'write_skill_loader'
  | 'write_bootstrap'
  | 'modify_ilinit'
  | 'write_file'
  | 'create_directory'
  | 'move_file';

/** Skill 操作计划步骤 */
export interface SkillApplyStep {
  type: SkillApplyStepType;
  target: string;
  description: string;
  backupTo?: string;
  /** V5.3 统一字段 */
  id?: string;
  title?: string;
  targetFile?: string;
  before?: string;
  after?: string;
  status?: string;
}

/** Skill 操作计划 */
export interface SkillApplyPlan {
  id: string;
  createdAt: string;
  summary: string;
  steps: SkillApplyStep[];
  warnings: { level: 'info' | 'warning' | 'danger'; message: string }[];
  requiresRestart: boolean;
  /** V5.3 统一字段 */
  title?: string;
  description?: string;
  module?: string;
  risks?: Array<{ id: string; severity: 'info' | 'warning' | 'error'; title: string; description?: string; suggestedAction?: string }>;
  backups?: Array<{ sourceFile: string; backupFile: string; required: boolean }>;
  targetFiles?: string[];
  status?: string;
  /** 旧版 Skill 执行入口的显式操作元数据，禁止再从 summary 文本反推。 */
  operation?: 'toggle' | 'delete' | 'sync-symphony-file';
  targetSkillPath?: string;
  targetSkillId?: string;
  targetEntryCommands?: string[];
  deleteOption?: ImpactOptionAction;
}

// ═══════════════════════════════════════════════════
// 影响分析（V5.1）
// ═══════════════════════════════════════════════════

/** 影响分析操作选项类型 */
export type ImpactOptionAction =
  | 'cancel'
  | 'just_disable_loader'
  | 'delete_and_comment_hotkeys'
  | 'delete_but_mark_invalid'
  | 'advanced_delete';

/** 影响分析操作选项 */
export interface ImpactOption {
  action: ImpactOptionAction;
  label: string;
  description: string;
  riskLevel: 'safe' | 'warning' | 'danger';
  steps: string[];
}

/** 删除/禁用 Skill 影响分析 */
export interface ImpactAnalysis {
  skillId: string;
  skillName: string;
  tier: SkillTier;
  canDelete: boolean;
  isReadonly: boolean;
  totalRefs: number;
  hotkeyRefs: HotkeyReference[];
  menuRefs: MenuReference[];
  issues: SkillReferenceIssue[];
  options: ImpactOption[];
}

/** 失效引用信息 */
export interface StaleRefInfo {
  bindingId: string;
  hotkeyKey: string;
  commandName: string;
  expectedSkillName: string;
  expectedSkillPath: string;
  source: string;
  lineNumber: number;
}

// ═══════════════════════════════════════════════════
// 公司 Skill 目录管理
// ═══════════════════════════════════════════════════

/** 手动添加的只读 Skill 目录 */
export interface ReadonlySkillDirectory {
  id: string;
  path: string;
  label?: string;
  sourceType: 'company_skill' | 'readonly_skill' | 'reference_skill';
  addedAt: string;
  skillCount: number;
}

// ═══════════════════════════════════════════════════
// 导入预览
// ═══════════════════════════════════════════════════

/** Skill 导入预览 */
export interface SkillImportPreview {
  name: string;
  files: Array<{
    path: string;
    functions: SkillFunctionItem[];
    entryCount: number;
    totalFunctions: number;
  }>;
  totalFiles: number;
  totalFunctions: number;
  totalEntryCommands: number;
  hasExistingDuplicate: boolean;
  duplicateCommands: string[];
  duplicateSkills: string[];
  suggestedHotkeys?: string[];
  needsLoader: boolean;
}

// ═══════════════════════════════════════════════════
// 加载源
// ═══════════════════════════════════════════════════

export type LoadStatusValue = 'loaded_configured' | 'enabled_but_not_loaded' | 'disabled' | 'readonly_reference' | 'unknown';

export interface SkillLoadResult {
  skillName: string;
  status: LoadStatusValue;
  sources: string[];
  detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface LoadSource {
  sourceType: 'ilinit' | 'skill_loader' | 'env' | 'bootstrap' | 'skill_manager';
  filePath: string;
  loadStatements: string[];
  exists: boolean;
}

// ═══════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════

/** ATM Managed Block 常量 - 用于 generated_skill_loader.il */
export const ATM_SKILL_LOADER_START = '; ===== ATM Generated Skill Loader Start =====';
export const ATM_SKILL_LOADER_END = '; ===== ATM Generated Skill Loader End =====';

/** ATM bootstrap.il 内容常量 */
export const ATM_BOOTSTRAP_START = '; ===== ATM Bootstrap Start =====';
export const ATM_BOOTSTRAP_END = '; ===== ATM Bootstrap End =====';

/** 入口命令启发式名称模式 */
export const ENTRY_COMMAND_PATTERNS = [
  '_main',
  '_run',
  '_start',
  '_cmd',
  'Action',
  'Main',
  'Run',
  'Start',
];

/** 内部函数启发式名称模式 */
export const INTERNAL_FUNCTION_PATTERNS = [
  'helper',
  'util',
  'parse',
  'validate',
  'internal',
  'private',
  '_helper',
  '_util',
  '_internal',
  '_private',
  'safe_',
  'notify',
  'warn',
  'log',
  'debug',
  'error_',
  'init_',
  'get_',
  'set_',
  'is_',
  'check_',
  'format_',
  'build_',
  'cleanup',
  'reset_',
  'update_',
  'find_',
  'load_',
  'save_',
];

/** 加载状态显示信息 */
export function getLoadStatusDisplay(status: SkillLoadStatus): {
  label: string;
  cssClass: string;
  icon: string;
  color: string;
} {
  switch (status) {
    case 'loaded_configured':
      return { label: '已配置加载', cssClass: 'load-status-loaded', icon: '', color: 'var(--accent-green)' };
    case 'enabled_but_not_loaded':
      return { label: '未配置启动加载', cssClass: 'load-status-maybe', icon: '', color: 'var(--accent-yellow)' };
    case 'disabled':
      return { label: '已禁用', cssClass: 'load-status-unknown', icon: '', color: 'var(--text-muted)' };
    case 'readonly_reference':
      return { label: '只读参考', cssClass: 'load-status-readonly', icon: '', color: 'var(--accent-purple)' };
    case 'unknown':
    case 'maybe_unloaded':
      return { label: '可能未加载', cssClass: 'load-status-maybe', icon: '', color: 'var(--accent-yellow)' };
  }
}

// ═══════════════════════════════════════════════════
// Skill 元数据（中文备注/自动简介）
// ═══════════════════════════════════════════════════

/** Skill 元数据 - 中文名称、备注、自动简介等 */
export interface SkillMeta {
  /** Skill 唯一标识 */
  skillId: string;
  /** Skill 文件路径 */
  filePath: string;
  /** 原始文件名（从文件路径提取，永远不被覆盖） */
  originalName: string;
  /** 用户自定义的中文显示名称（推荐使用 userName） */
  displayName?: string;
  /** 用户设置的中文名称（替代 displayName） */
  userName?: string;
  /** 用户备注 */
  userNote?: string;
  /** 自动生成的中文名称 */
  autoName?: string;
  /** 自动生成的中文简介 */
  autoSummary?: string;
  /** 自动生成的分类 */
  autoCategory?: string;
  /** 用户手动设置的分类 */
  userCategory?: string;
  /** 标签列表 */
  tags?: string[];
  /** 分析可信度 */
  confidence?: ConfidenceLevel;
  /** 显示模式 */
  displayMode?: 'original' | 'chinese' | 'bilingual';
  /** 分析生成时间 */
  generatedAt?: string;
  /** 最后更新时间 */
  updatedAt?: string;
}

/** 来源类型标签 */
export function getSourceTypeLabel(type: SkillSourceType): string {
  switch (type) {
    case 'user_skill': return '用户 Skill';
    case 'company_skill': return '公司 Skill';
    case 'atm_managed_skill': return 'ATM 托管';
    case 'unknown': return '未知';
  }
}

// ═══════════════════════════════════════════════════
// V5.2 Skill 使用状态总览
// ═══════════════════════════════════════════════════

/** Skill 综合使用状态 */
export type SkillUsageStatus =
  | 'available'
  | 'available_unreferenced'
  | 'referenced_but_not_loaded'
  | 'command_conflict'
  | 'parse_error'
  | 'readonly_reference'
  | 'missing_file'
  | 'disabled';

/** 健康度扣分项 */
export interface HealthDeduction {
  reason: string;
  points: number;
}

/** Skill 综合使用信息 */
export interface SkillUsageInfo {
  status: SkillUsageStatus;
  reasons: string[];
  healthScore: number;
  healthDeductions: HealthDeduction[];
}

/** 使用状态显示的配置 */
export const USAGE_STATUS_DISPLAY: Record<SkillUsageStatus, { label: string; icon: string; color: string }> = {
  available: { label: '可用', icon: '', color: 'var(--accent-green)' },
  available_unreferenced: { label: '可用（无引用）', icon: '', color: 'var(--accent-cyan)' },
  referenced_but_not_loaded: { label: '有引用未加载', icon: '', color: 'var(--accent-yellow)' },
  command_conflict: { label: '命令冲突', icon: '', color: 'var(--accent-red)' },
  parse_error: { label: '解析失败', icon: '', color: 'var(--accent-red)' },
  readonly_reference: { label: '只读参考', icon: '', color: 'var(--accent-purple)' },
  missing_file: { label: '文件缺失', icon: '', color: 'var(--accent-red)' },
  disabled: { label: '已禁用', icon: '', color: 'var(--text-muted)' },
};

// ═══════════════════════════════════════════════════
// V5.2 Skill 使用关系树
// ═══════════════════════════════════════════════════

/** 使用关系树节点类型 */
export type UsageTreeNodeType = 'skill' | 'command' | 'hotkey' | 'menu' | 'empty';

/** 使用关系树节点 */
export interface UsageTreeNode {
  name: string;
  type: UsageTreeNodeType;
  path?: string;
  detail?: string;
  source?: string;
  lineNumber?: number;
  loadStatus?: SkillLoadStatus;
  conflictStatus?: ConflictStatus;
  isLoaded?: boolean;
  hasConflict?: boolean;
  isStale?: boolean;
  children?: UsageTreeNode[];
}

// ═══════════════════════════════════════════════════
// V5.2 Skill 配置文件
// ═══════════════════════════════════════════════════

/** Skill 配置文件信息 */
export interface SkillConfigFile {
  fileName: string;
  filePath: string;
  exists: boolean;
  isReadonly?: boolean;
  size?: number;
  lastModified?: string;
}

/** 配置操作类型 */
export type ConfigActionType = 'view' | 'edit' | 'backup' | 'restore';

// ═══════════════════════════════════════════════════
// V5.2 健康度评分
// ═══════════════════════════════════════════════════

/** Skill 健康度评分信息 */
export interface SkillHealthInfo {
  score: number;
  deductions: HealthDeduction[];
}

/** 健康度区间 */
export type HealthLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/** 根据分数获取健康度等级 */
export function getHealthLevel(score: number): HealthLevel {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

/** 健康度等级颜色 */
export const HEALTH_LEVEL_COLORS: Record<HealthLevel, string> = {
  excellent: 'var(--accent-green)',
  good: 'var(--accent-cyan)',
  fair: 'var(--accent-yellow)',
  poor: 'var(--accent-orange)',
  critical: 'var(--accent-red)',
};
