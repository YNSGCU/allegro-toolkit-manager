/**
 * ATM - Allegro Toolkit Manager
 * 快捷键相关类型定义（V1.5：Profile/来源分离/编辑）
 */

/** env 文件中的一行条目 */
export interface EnvEntry {
  type: 'funckey' | 'alias' | 'raw' | 'comment' | 'blank';
  key?: string;
  command?: string;
  raw: string;
  lineNumber: number;
  source: 'user_original' | 'atm_managed';
}

/** 快捷键绑定来源 */
export type BindingSourceType =
  | 'user_env_original'     // 用户原始 env 中的快捷键
  | 'atm_managed_block'     // ATM 托管块中的快捷键
  | 'active_profile'        // 当前选中方案中的快捷键
  | 'imported_profile'      // 从外部导入的快捷键
  | 'generated'             // ATM 自动生成的快捷键
  | 'install_default_env'   // Allegro 安装目录默认 env（V3.0 多 env）
  | 'site_env'              // 站点级 env（V3.0 多 env）
  | 'company_env'           // 公司统一配置 env（V3.0 多 env）
  | 'reference_env'         // 用户手动添加的参考 env
  | 'allegro_default'       // Allegro 软件默认占用键（F1-F12 等）
  | 'system_reserved'       // 系统保留键（Alt+F4, Ctrl+Alt+Del 等）
  | 'skill_direct'          // Skill 文件内部直接注册的快捷键（axlSetFunckey / axlSetAlias）
  | 'menu_accelerator'      // 菜单加速键
  | 'unknown';              // 未知来源

/** 命令来源类型 */
export const MANAGED_BINDING_SOURCES: BindingSourceType[] = [
  'atm_managed_block',
  'active_profile',
  'imported_profile',
  'generated',
];

export function isManagedBindingSource(source?: BindingSourceType | string): boolean {
  if (!source) {
    return false;
  }
  return MANAGED_BINDING_SOURCES.includes(source as BindingSourceType);
}

export type CommandSourceType =
  | 'allegro_builtin'       // Allegro 内置命令
  | 'user_skill'            // 本地用户 Skill
  | 'company_skill'         // 公司只读 Skill
  | 'atm_managed_skill'     // ATM 托管 Skill
  | 'ambiguous'             // 命中多种来源（Skill + 内置）
  | 'unknown';              // 未知

/** 快捷键绑定状态 */
export type BindingStatus =
  | 'normal'
  | 'duplicate'
  | 'prefix_conflict'
  | 'missing_command'
  | 'reserved'
  | 'disabled'
  | 'adopted';              // 已接管到方案

/** 快捷键绑定 */
export interface HotkeyBinding {
  id: string;
  key: string;
  command: string;
  type: 'funckey' | 'alias';
  /** 快捷键来源（这条绑定的物理来源） */
  bindingSource: BindingSourceType;
  /** @deprecated 使用 bindingSource 替代，保留用于向后兼容 */
  source?: 'user_original' | 'atm_managed' | 'unknown';
  /** 快捷键状态 */
  status: BindingStatus;
  lineNumber?: number;
  notes?: string[];

  // ── 命令分类（V1.4+） ──
  /** 中文命令显示（来自命令字典） */
  chineseName?: string;
  /** 命令分类 */
  category?: string;
  /** 命令描述 */
  description?: string;
  /** 命令来源（command 来自哪里） */
  commandSource?: CommandSourceType;
  /** 所属 Skill 名称 */
  skillName?: string | null;
  /** 所属 Skill 文件路径 */
  skillFilePath?: string | null;
  /** Skill 层级 */
  skillTier?: string | null;
  /** 识别可信度 */
  confidence?: 'high' | 'medium' | 'low';
  /** Skill 加载状态 */
  loadStatus?: LoadStatusValue;

  // ── Profile 相关（V1.5） ──
  /** 所属方案 ID（如果属于某个 Profile） */
  profileId?: string;
  /** 所属方案名称 */
  profileName?: string;
  /** 是否已被接管到方案 */
  isAdopted?: boolean;

  // ── 多 env 来源（V3.0） ──
  /** 来源 env 文件 ID（对应 EnvSource.id） */
  envSourceId?: string;
  /** 来源 env 文件角色 */
  envRole?: string;

  // ── 编辑相关 ──
  /** 是否被编辑过（未保存） */
  isDirty?: boolean;
  /** 是否被用户手动修正过来源 */
  isSourceOverridden?: boolean;
  /** 额外提示信息（如同名 Skill 检测） */
  extraHint?: string | null;
  /** 同名的 Skill 名称 */
  sameNameSkill?: string | null;
  /** 是否启用 */
  enabled?: boolean;

  // ── 显示/编辑控制（V1.6） ──
  /** 是否可编辑（false 表示只读，如系统保留键） */
  editable?: boolean;
  /** 用户覆盖此键时是否警告 */
  warnWhenOverride?: boolean;
  /** 是否在「我的快捷键」视图中可见 */
  visibleInUserMap?: boolean;
  /** 是否在「软件默认/保留键」视图中可见 */
  visibleInReservedMap?: boolean;
  /** 默认占用方的描述（显示在冲突信息中） */
  defaultOccupier?: {
    command: string;
    description: string;
    source: string;
  };

  // ── 键名归一化（V2 修饰键层） ──
  /** 归一化主键（不含修饰符） */
  primaryKey?: string;
  /** 修饰键列表，如 ["Ctrl"]、["Ctrl", "Shift"] */
  modifiers?: string[];
  /** 显示用键名，如 "Ctrl+C"、"Shift+F1" */
  displayKey?: string;
  /** 大小写变体：upper / lower / none（V2.2） */
  caseVariant?: string;
  /** 修饰键层标识：base / ctrl / shift / alt / combo（V2.2） */
  layer?: string;
}

/** 冲突检测结果 */
export interface Conflict {
  type:
    | 'funckey_duplicate'
    | 'alias_duplicate'
    | 'alias_prefix'
    | 'cross_type_same_name'
    | 'missing_command'
    | 'reserved_key'
    | 'reserved_key_warning'
    | 'skill_unloaded'
    | 'cross_env_override';   // V3.0: 用户 env 覆盖参考/默认 env
  severity: 'error' | 'warning' | 'info';
  message: string;
  bindings: HotkeyBinding[];
}

/** 冲突检测结果集 */
export interface ValidationResult {
  conflicts: Conflict[];
  bindings: HotkeyBinding[];
  stats: {
    total: number;
    funckeyCount: number;
    aliasCount: number;
    errorCount: number;
    warningCount: number;
  };
}

/** env 解析结果 */
export interface ParseEnvResult {
  entries: EnvEntry[];
  warnings: string[];
  hasManagedBlock: boolean;
  managedBlockRange?: {
    startLine: number;
    endLine: number;
  };
}

/** Apply Plan 动作类型 */
export type ApplyStepType =
  | 'backup'
  | 'modify_managed_block'
  | 'insert_bootstrap'
  | 'write_file'
  | 'create_directory'
  | 'modify_profile'
  | 'write_profile';

/** Apply Plan 中的一个步骤 */
export interface ApplyStep {
  type: ApplyStepType;
  target: string;
  backupTo?: string;
  description: string;
}

/** Apply Plan 警告 */
export interface PlanWarning {
  level: 'info' | 'warning' | 'danger';
  message: string;
}

/** Apply Plan */
export interface ApplyPlan {
  id: string;
  createdAt: string;
  summary: string;
  steps: ApplyStep[];
  warnings: PlanWarning[];
  requiresRestart: boolean;
  rollbackManifestPath?: string;
  managedBindings?: HotkeyBinding[];
}

/** 执行结果 */
export interface ApplyResult {
  success: boolean;
  planId: string;
  appliedSteps: number;
  totalSteps: number;
  error?: string;
  rollbackPath?: string;
}

// ── Profile 相关类型 ──

/** 快捷键方案 */
export interface HotkeyProfile {
  /** 方案唯一 ID */
  id: string;
  /** 方案名称 */
  name: string;
  /** 方案描述 */
  description?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 方案中的快捷键列表 */
  bindings: HotkeyProfileBinding[];
}

/** 方案中的快捷键条目 */
export interface HotkeyProfileBinding {
  id: string;
  key: string;
  command: string;
  type: 'funckey' | 'alias';
  chineseName?: string;
  commandSource?: CommandSourceType;
  enabled: boolean;
  note?: string;
}

/** Profile 差异比较结果 */
export interface ProfileDiff {
  sourceProfileId: string;
  targetProfileId: string;
  added: HotkeyProfileBinding[];
  removed: HotkeyProfileBinding[];
  modified: { before: HotkeyProfileBinding; after: HotkeyProfileBinding }[];
}

// ── 编辑器相关类型 ──

/** 编辑请求 */
export interface HotkeyEditRequest {
  bindingId: string;
  type?: 'funckey' | 'alias';
  key?: string;
  command?: string;
  chineseName?: string;
  enabled?: boolean;
  note?: string;
  commandSource?: CommandSourceType;
  profileId?: string;
}

/** 编辑时实时检测结果 */
export interface HotkeyEditValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
  /** env 中是否有相同按键 */
  duplicateInEnv: boolean;
  /** Profile 中是否有相同按键 */
  duplicateInProfile: boolean;
  /** 是否为保留键 */
  isReservedKey: boolean;
  isReservedWarning: boolean;
  /** 命令是否可识别 */
  commandRecognized: boolean;
  /** Skill 是否可能未加载 */
  skillMaybeUnloaded: boolean;
  /** 是否为软件默认键（F3 等） */
  isSoftwareDefault: boolean;
}

/** ATM 托管块标记常量 */
export const ATM_MANAGED_BLOCK_START = '# ===== ATM Managed Hotkeys Start =====';
export const ATM_MANAGED_BLOCK_END = '# ===== ATM Managed Hotkeys End =====';

/** ATM Bootstrap 标记常量 */
export const ATM_BOOTSTRAP_START = '; ===== ATM Bootstrap Start =====';
export const ATM_BOOTSTRAP_END = '; ===== ATM Bootstrap End =====';

// ── 编辑影响预览（V4.0） ──

/** 编辑影响预览 */
export interface EditImpactPreview {
  /** 被修改的快捷键 */
  modifiedBinding: HotkeyBinding | null;
  /** 即将使用的新按键 */
  newKey: string;
  /** 新按键是否已被占用 */
  newKeyOccupied: boolean;
  occupiedBy?: string;
  /** 是否覆盖默认/保留键 */
  overridesReserved: boolean;
  reservedKeyInfo?: string;
  /** 与当前 Profile 冲突 */
  conflictsWithProfile: boolean;
  profileConflictInfo?: string;
  /** 与当前用户 env 冲突 */
  conflictsWithEnv: boolean;
  envConflictInfo?: string;
  /** 修改前后对比 */
  beforeRawLine?: string;
  afterRawLine?: string;
  /** 是否需要重启 Allegro */
  requiresRestart: boolean;
  /** 风险级别 */
  riskLevel: 'safe' | 'warning' | 'danger';
  /** 影响详情列表 */
  impacts: EditImpactItem[];
}

export interface EditImpactItem {
  type: 'info' | 'warning' | 'error';
  message: string;
}

// ── 增强冲突检测（V4.0） ──

export type EnhancedConflictType =
  | 'same_env_duplicate'
  | 'reserved_key_override'
  | 'unrecognized_command'
  | 'skill_not_loaded'
  | 'cross_env_override'
  | 'profile_override_env'
  | 'funckey_duplicate'
  | 'alias_duplicate'
  | 'alias_prefix'
  | 'cross_type_same_name';

export interface EnhancedConflict extends Conflict {
  id: string;
  subType: EnhancedConflictType;
  suggestions: string[];
  ignoreable: boolean;
  involvedKeys: string[];
  involvedFiles: string[];
  envSourceId?: string;
}

// ── 变更历史（V4.0） ──

export interface ChangeRecord {
  id: string;
  timestamp: string;
  operation: 'modify_env' | 'add_env_line' | 'comment_env_line' | 'plan_apply' | 'undo' | 'restore';
  summary: string;
  targetFile: string;
  backupFile: string;
  backupId: string;
  stepsCount: number;
  planId: string;
  undoable: boolean;
  restorePoint?: boolean;
}

// ── 推荐可用键位（V4.0） ──

export interface KeyRecommendation {
  key: string;
  displayKey: string;
  status: 'available' | 'occupied' | 'reserved' | 'system' | 'profile_used';
  occupiedBy?: string;
  reason?: string;
  priority: number;
  category: 'function_key' | 'ctrl_combo' | 'alt_combo' | 'lowercase' | 'uppercase' | 'other';
}

// ── 导出选项（V4.0） ──

export interface ExportOptions {
  includeCommand: boolean;
  includeSource: boolean;
  includeLineNumber: boolean;
  groupBy: 'category' | 'source' | 'none';
  filterMode: 'all' | 'favorites' | 'profile' | 'source';
  filterValue?: string;
  title?: string;
  date?: string;
  format: 'markdown' | 'html';
}

// ── 原始行查看（V4.0） ──

export interface RawLineContext {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  contextBefore: string[];
  contextAfter: string[];
  isReference: boolean;
  exists: boolean;
}

// ── Skill 加载状态（V4.0） ──

export type LoadStatusValue = 'loaded_configured' | 'maybe_unloaded' | 'unknown' | 'readonly_reference';

export interface SkillLoadResult {
  skillName: string;
  status: LoadStatusValue;
  sources: string[];
  detail: string;
  confidence: 'high' | 'medium' | 'low';
}

// ── 收藏（V4.0） ──

export interface HotkeyFavorites {
  version: number;
  favoriteBindingIds: string[];
  updatedAt: string;
}

/** 系统保留键列表 */
export const RESERVED_KEYS: string[] = [
  'Alt+F4',
  'Ctrl+Alt+Del',
  'Ctrl+Shift+Esc',
  'Alt+Tab',
  'Ctrl+Esc',
  'Alt+Space',
  'Alt+F7',
  'Alt+F8',
  'Ctrl+Alt+Tab',
  'Win',
  'Pause',
  'Break',
];
