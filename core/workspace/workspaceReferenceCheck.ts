/**
 * ATM - 工作区跨模块引用一致性校验（V6.3）
 *
 * 校验「菜单方案 / 快捷键方案」引用的命令，是否由目标 Skill 方案中
 * 已启用的 Skill 提供，用于切换工作区前发现问题。
 *
 * 判定规则：
 *  - Allegro 内置命令：跳过（视为已满足）
 *  - 已启用 Skill 提供的命令：通过
 *  - 仅由未启用 Skill 提供的命令：warning（应用目标 Skill 方案后命令将失效）
 *  - 找不到任何提供者的命令：warning（可能是内置命令未收录或 Skill 缺失）
 *
 * 纯函数、不访问文件系统，输入由 IPC 层组装后传入。
 */
import { ALLEGRO_BUILTIN_COMMANDS } from '../validator/commandClassifier';
import { extractBaseCommand } from '../skill/commandIndex';

export type WorkspaceRefScope = 'hotkey' | 'menu';
export type WorkspaceRefSeverity = 'info' | 'warning' | 'error';

export interface WorkspaceRefIssue {
  severity: WorkspaceRefSeverity;
  scope: WorkspaceRefScope;
  /** 引用来源：快捷键键位或菜单完整路径 */
  source: string;
  /** 原始命令文本 */
  command: string;
  detail: string;
}

export interface WorkspaceReferenceCheckInput {
  /** 快捷键方案中的启用绑定（key + command） */
  hotkeyBindings?: Array<{ key: string; command: string }>;
  /** 菜单方案中已扁平化带完整路径的菜单项 */
  menuItems?: Array<{ path: string; label?: string; command?: string }>;
  /** 目标 Skill 方案中「启用」的 Skill ID 集合 */
  enabledSkillIds?: string[];
  /** 环境中扫描到的全部 Skill 及其入口命令/函数 */
  scannedSkills?: Array<{ skillId: string; name: string; commands: string[] }>;
}

export interface WorkspaceReferenceCheckResult {
  issues: WorkspaceRefIssue[];
  errors: WorkspaceRefIssue[];
  warnings: WorkspaceRefIssue[];
  infos: WorkspaceRefIssue[];
  /** 引用校验为纯提示项，不阻断应用（是否阻断由各模块自身校验决定） */
  blocked: boolean;
  summary: {
    checked: number;
    resolved: number;
    builtin: number;
    disabledProvider: number;
    unresolved: number;
  };
}

interface CommandProvider {
  skillId: string;
  name: string;
}

function buildProviderIndex(skills: Array<{ skillId: string; name: string; commands: string[] }>): Map<string, CommandProvider[]> {
  const index = new Map<string, CommandProvider[]>();
  for (const skill of skills) {
    for (const raw of skill.commands ?? []) {
      const base = extractBaseCommand(raw);
      if (!base || ALLEGRO_BUILTIN_COMMANDS.has(base)) continue;
      const list = index.get(base) ?? [];
      if (!list.some((p) => p.skillId === skill.skillId)) {
        list.push({ skillId: skill.skillId, name: skill.name });
      }
      index.set(base, list);
    }
  }
  return index;
}

/**
 * 执行跨模块引用一致性校验。
 *
 * @param input 由 IPC 层组装好的引用数据（不访问文件系统）
 */
export function checkWorkspaceReferences(input: WorkspaceReferenceCheckInput): WorkspaceReferenceCheckResult {
  const issues: WorkspaceRefIssue[] = [];
  const providerIndex = buildProviderIndex(input.scannedSkills ?? []);
  const enabledSet = new Set(input.enabledSkillIds ?? []);
  const summary = { checked: 0, resolved: 0, builtin: 0, disabledProvider: 0, unresolved: 0 };

  const refs: Array<{ scope: WorkspaceRefScope; source: string; command: string }> = [];
  for (const binding of input.hotkeyBindings ?? []) {
    if (!binding.command?.trim()) continue;
    refs.push({
      scope: 'hotkey',
      source: `快捷键 ${binding.key || '（空键）'}`,
      command: binding.command,
    });
  }
  for (const item of input.menuItems ?? []) {
    if (!item.command?.trim()) continue;
    refs.push({
      scope: 'menu',
      source: `菜单 ${item.path || item.label || '（未命名项）'}`,
      command: item.command,
    });
  }

  for (const ref of refs) {
    const base = extractBaseCommand(ref.command);
    if (!base) continue;
    summary.checked += 1;

    if (ALLEGRO_BUILTIN_COMMANDS.has(base)) {
      summary.builtin += 1;
      continue;
    }

    const providers = providerIndex.get(base) ?? [];
    if (providers.length === 0) {
      summary.unresolved += 1;
      issues.push({
        severity: 'warning',
        scope: ref.scope,
        source: ref.source,
        command: ref.command,
        detail: `未找到提供命令「${base}」的 Skill，也不在 Allegro 内置命令表内，命令可能失效`,
      });
      continue;
    }

    const enabledProviders = providers.filter((provider) => enabledSet.has(provider.skillId));
    if (enabledProviders.length > 0) {
      summary.resolved += 1;
      continue;
    }

    summary.disabledProvider += 1;
    const names = [...new Set(providers.map((provider) => provider.name))].join('、');
    issues.push({
      severity: 'warning',
      scope: ref.scope,
      source: ref.source,
      command: ref.command,
      detail: `命令「${base}」由 Skill「${names}」提供，但目标 Skill 方案未启用这些 Skill，应用后命令将失效`,
    });
  }

  return {
    issues,
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    infos: issues.filter((issue) => issue.severity === 'info'),
    blocked: false,
    summary,
  };
}
