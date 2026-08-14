/**
 * ATM - Env 可视化编辑器类型定义
 */

/** 编辑器条目类型（比 EnvEntry 多出 variable 类型） */
export type EnvEditorEntryType = 'funckey' | 'alias' | 'variable' | 'comment' | 'blank' | 'raw';

/** 编辑器条目来源 */
export type EnvEditorSource = 'user_original' | 'atm_managed';

/** env 编辑器中的单个条目 */
export interface EnvEditorEntry {
  /** 稳定 id：已有条目 `line_<n>`，新增条目 `new_<随机>` */
  id: string;
  type: EnvEditorEntryType;
  /** funckey/alias/variable 的键名 */
  key?: string;
  /** funckey/alias 的命令，或 variable 的值 */
  value?: string;
  /** 原始行文本（未修改时原样保留） */
  raw: string;
  /** 行号（从 1 开始，0 表示新增未落盘） */
  lineNumber: number;
  source: EnvEditorSource;
  /** 是否被编辑过（key/value/type 变化或删除） */
  dirty: boolean;
  /** 是否标记为删除（序列化时注释原行） */
  deleted: boolean;
}

/** env 编辑器文档 */
export interface EnvEditorDocument {
  filePath: string;
  entries: EnvEditorEntry[];
  warnings: string[];
}

/** 单条目编辑 patch */
export interface EnvEditPatch {
  id: string;
  type?: EnvEditorEntryType;
  key?: string;
  value?: string;
  deleted?: boolean;
}

/** 行级编辑步骤（用于 Apply Plan 预览） */
export interface EnvEditStep {
  opType: 'add' | 'modify' | 'delete';
  lineNumber: number;
  before: string;
  after: string;
  description: string;
}

/** env:editor-load 返回 */
export interface EnvEditorLoadResult {
  filePath: string;
  encoding: 'utf8' | 'gbk';
  /** 原始文件 SHA-256，用于 apply 前防外部修改 */
  contentHash: string;
  document: EnvEditorDocument;
}

/** env:editor-preview 返回 */
export interface EnvEditorPreviewResult {
  steps: EnvEditStep[];
  newContent: string;
}

/** env:editor-apply 输入 */
export interface EnvEditorApplyInput {
  entries: EnvEditorEntry[];
  encoding: 'utf8' | 'gbk';
  expectedHash: string;
}

// ═══════════════════════════════════════════════
// Env 来源对比
// ═══════════════════════════════════════════════

/** 可比较的条目类型 */
export type EnvCompareType = 'funckey' | 'alias' | 'variable';

/** 差异状态：only_a = 仅在用户 env，only_b = 仅在参考 env */
export type EnvCompareStatus = 'only_a' | 'only_b' | 'different';

export interface EnvCompareDiff {
  type: EnvCompareType;
  key: string;
  aValue?: string;
  bValue?: string;
  status: EnvCompareStatus;
}

export interface EnvCompareSummary {
  onlyA: number;
  onlyB: number;
  different: number;
  total: number;
}

export interface EnvCompareResult {
  aLabel: string;
  aPath: string;
  bLabel: string;
  bPath: string;
  diffs: EnvCompareDiff[];
  summary: EnvCompareSummary;
}
