/**
 * ATM - 统一工作区应用规划层（V6.2）
 *
 * 决定统一应用的顺序、环境锁与缺失方案检查。纯函数、不执行写入。
 * 各模块的具体 Apply Plan 生成与执行由 IPC 层按此顺序串联，
 * 全部复用既有 Apply Plan / 备份 / 回滚链路。
 */
import type { WorkspaceProfile } from '../../src/types/workspaceProfile';

export type WorkspaceApplyModule = 'hotkey' | 'skill' | 'menu' | 'color';

/** 应用顺序：Skill 被菜单/快捷键引用，先应用；菜单其次；快捷键再次；配色为全局资源最后 */
export const WORKSPACE_APPLY_ORDER: Array<{ module: WorkspaceApplyModule; label: string }> = [
  { module: 'skill', label: 'Skill 方案' },
  { module: 'menu', label: '菜单方案' },
  { module: 'hotkey', label: '快捷键方案' },
  { module: 'color', label: '配色方案' },
];

export interface WorkspaceApplyModuleState {
  available: boolean;
  requiresEnvironment: boolean;
}

export interface WorkspaceApplySequenceStep {
  module: WorkspaceApplyModule;
  label: string;
}

export interface WorkspaceApplySequence {
  workspaceId: string;
  workspaceName: string;
  environmentId?: string;
  order: WorkspaceApplySequenceStep[];
  warnings: string[];
  /** true 表示存在缺失方案或环境锁不匹配，不允许执行 */
  blocked: boolean;
  blockedReason?: string;
}

/**
 * 规划统一应用序列。
 *
 * @param workspace 目标工作区
 * @param currentEnvironmentId 当前激活环境（用于环境锁）
 * @param moduleStates 各子方案是否可用（hotkey/skill/menu 需要环境，color 为全局）
 */
export function planWorkspaceApplySequence(
  workspace: WorkspaceProfile,
  currentEnvironmentId: string | null,
  moduleStates: Record<WorkspaceApplyModule, boolean>,
): WorkspaceApplySequence {
  const warnings: string[] = [];
  const order: WorkspaceApplySequenceStep[] = [];

  // 环境锁：工作区绑定环境时，必须与当前激活环境一致
  if (workspace.environmentId && workspace.environmentId !== currentEnvironmentId) {
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      environmentId: workspace.environmentId,
      order: [],
      warnings,
      blocked: true,
      blockedReason: `工作区绑定环境 ${workspace.environmentId}，当前激活为 ${currentEnvironmentId ?? '未设置'}，请先切换环境`,
    };
  }

  for (const { module, label } of WORKSPACE_APPLY_ORDER) {
    const available = moduleStates[module];
    if (!available) {
      if (module === 'color') {
        // 配色未绑定是可选项，跳过即可
        continue;
      }
      warnings.push(`${label}未绑定或不存在，本次跳过`);
      continue;
    }
    order.push({ module, label });
  }

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    environmentId: workspace.environmentId ?? currentEnvironmentId ?? undefined,
    order,
    warnings,
    blocked: order.length === 0,
    blockedReason: order.length === 0 ? '工作区没有任何可应用的方案' : undefined,
  };
}
