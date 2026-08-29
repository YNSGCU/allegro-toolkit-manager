/**
 * ATM - 跨版本方案同步类型定义（V6.4 设计稿落地）
 *
 * 同步以「目标环境命令可用性」为边界：通用命令双向对齐，版本特有命令
 * 默认跳过并给出原因；写入仍走各模块 Apply Plan。
 */

export type SyncItemKind = 'hotkey' | 'skill' | 'menu';

export type SyncItemDecision =
  | 'sync'         // 目标环境有提供者，同步
  | 'skip_ver'     // 版本特有：目标环境无提供者，默认跳过
  | 'skip_unknown' // 两边都不认识，警告并跳过
  | 'keep_target'  // 目标独有：保留（默认不删除）
  | 'user_force';  // 用户规则或勾选强制同步（即使目标无提供者）

export interface CrossVersionSyncItem {
  kind: SyncItemKind;
  /** 快捷键 key / skillId / 菜单完整路径 */
  ref: string;
  command: string;
  decision: SyncItemDecision;
  reason?: string;
  /** 源方案条目（用于生成目标方案） */
  sourceValue: unknown;
  /** 目标方案现有条目（对比展示） */
  targetValue?: unknown;
  /** 是否为用户规则记忆覆盖、需要确认 */
  askConfirm?: boolean;
}

export interface CrossVersionSyncStats {
  sync: number;
  skip_ver: number;
  skip_unknown: number;
  keep_target: number;
  user_force: number;
}

export interface CrossVersionSyncEnvironmentRef {
  environmentId: string;
  version: string;
  pcbenvPath?: string;
  homePath?: string;
}

export interface CrossVersionSyncPlan {
  source: CrossVersionSyncEnvironmentRef;
  target: CrossVersionSyncEnvironmentRef;
  items: CrossVersionSyncItem[];
  stats: CrossVersionSyncStats;
  blocked: boolean;
  blockedReason?: string;
}

/** 用户勾选覆盖（UI → sync:apply） */
export interface SyncDecisionsInput {
  kind: SyncItemKind;
  ref: string;
  decision: SyncItemDecision;
}

/** 环境对前置校验结果 */
export interface EnvironmentPairCheckResult {
  ok: boolean;
  /** 中文问题列表 */
  issues: string[];
  sameDirectory: boolean;
  sameVersion: boolean;
}

// ═══════════════════════════════════════════════════
// 同步规则记忆（sync_rules.json）
// ═══════════════════════════════════════════════════

export type SyncRuleDecision = 'always_sync' | 'always_skip' | 'ask';

export interface CrossVersionSyncRule {
  command: string;
  targetVersion: string;
  decision: SyncRuleDecision;
  note?: string;
  updatedAt: string;
}

export interface SyncRuleStore {
  version: '1.0';
  rules: CrossVersionSyncRule[];
  updatedAt: string;
}

/** 命令可用性：内置命令或 Skill 提供的提供者信息 */
export interface CommandAvailabilityProvider {
  scope: 'builtin' | 'skill';
  skillId?: string;
  skillName?: string;
}
