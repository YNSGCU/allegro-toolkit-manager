/**
 * ATM - 跨版本同步计划生成（V6.4，M1）
 *
 * 纯函数：给定源/目标环境与方案快照、目标环境命令集、规则记忆，
 * 生成分类清单（sync / skip_ver / skip_unknown / keep_target / user_force）。
 * 不访问文件系统、不写入；合并与 Apply Plan 由上层完成。
 */
import { baseCommandOf, queryCommandAvailability } from './commandAvailability';
import { findRule } from './syncRules';
import { scoreNameSimilarity } from '../workspace/workspaceImportExport';
import type {
  CommandAvailabilityProvider,
  CrossVersionSyncEnvironmentRef,
  CrossVersionSyncItem,
  CrossVersionSyncPlan,
  CrossVersionSyncStats,
  SyncItemDecision,
  SyncRuleStore,
} from '../../src/types/sync';
import type { HotkeyProfile, HotkeyProfileBinding } from '../../src/types/hotkey';
import type { SkillProfile, SkillProfileItem } from '../../src/types/skillProfile';
import type { MenuItemConfig, MenuProfile } from '../../src/types/menu';

export interface CrossVersionSyncInput {
  source: CrossVersionSyncEnvironmentRef;
  target: CrossVersionSyncEnvironmentRef;
  /** 目标环境命令索引（buildCommandAvailability 产物） */
  targetCommands: Map<string, CommandAvailabilityProvider[]>;
  /** 源环境命令索引（可选；用于区分“版本特有”与“两边未知”） */
  sourceCommands?: Map<string, CommandAvailabilityProvider[]>;
  sourceHotkey?: HotkeyProfile | null;
  targetHotkey?: HotkeyProfile | null;
  sourceSkill?: SkillProfile | null;
  targetSkill?: SkillProfile | null;
  sourceMenu?: MenuProfile | null;
  targetMenu?: MenuProfile | null;
  rules: SyncRuleStore;
  /** 生成说明（源实时快照等），原样透传到计划 */
  notes?: string[];
}

const EMPTY_STATS: CrossVersionSyncStats = {
  sync: 0,
  skip_ver: 0,
  skip_unknown: 0,
  keep_target: 0,
  user_force: 0,
};

function bump(stats: CrossVersionSyncStats, decision: SyncItemDecision): void {
  stats[decision] += 1;
}

function providerNames(providers: CommandAvailabilityProvider[]): string {
  return [...new Set(providers.map((provider) => provider.skillName ?? provider.scope))].join('、');
}

/** 命令分类：目标可用 → 同步；目标不可用 → 版本特有/未知，叠加规则记忆 */
export function classifyCommand(
  command: string,
  targetCommands: Map<string, CommandAvailabilityProvider[]>,
  sourceCommands: Map<string, CommandAvailabilityProvider[]> | undefined,
  rules: SyncRuleStore,
  targetVersion: string,
): { decision: SyncItemDecision; reason?: string; askConfirm?: boolean } {
  const base = baseCommandOf(command);
  if (!base) return { decision: 'sync' };

  const { available, providers } = queryCommandAvailability(targetCommands, command);
  const rule = findRule(rules, command, targetVersion);

  if (available) {
    if (rule?.decision === 'always_skip') {
      return { decision: 'skip_ver', reason: `规则记忆：跳过 ${base}（目标版本可用的命令）`, askConfirm: false };
    }
    if (rule?.decision === 'ask') {
      return { decision: 'sync', askConfirm: true };
    }
    return { decision: 'sync' };
  }

  // 目标环境无提供者
  if (rule?.decision === 'always_sync') {
    return { decision: 'user_force', reason: `用户规则强制同步 ${base}（目标版本无提供者）` };
  }
  if (rule?.decision === 'ask') {
    return { decision: 'skip_ver', reason: `规则记忆：每次询问后暂跳 ${base}`, askConfirm: true };
  }

  const sourceHit = sourceCommands
    ? queryCommandAvailability(sourceCommands, command).available
    : true;
  if (sourceHit) {
    const sourceProviders = sourceCommands
      ? queryCommandAvailability(sourceCommands, command).providers
      : [];
    const names = providerNames(sourceProviders);
    return {
      decision: 'skip_ver',
      reason: names
        ? `命令 ${base} 由源环境 ${names} 提供，目标版本 ${targetVersion} 无对应提供者`
        : `目标版本 ${targetVersion} 未找到提供该命令的内置命令或 Skill`,
    };
  }
  return { decision: 'skip_unknown', reason: `源与目标环境都未识别命令 ${base}` };
}

function alignHotkey(
  sourceBindings: HotkeyProfileBinding[],
  targetBindings: HotkeyProfileBinding[],
  ctx: CrossVersionSyncInput,
): CrossVersionSyncItem[] {
  const items: CrossVersionSyncItem[] = [];
  const seenTarget = new Set<string>();

  for (const binding of sourceBindings) {
    if (!binding.command?.trim()) continue;
    const ref = `${binding.type}:${binding.key}`;
    const target = targetBindings.find((item) => `${item.type}:${item.key}` === ref) ?? null;
    if (target) seenTarget.add(ref);
    const verdict = classifyCommand(
      binding.command,
      ctx.targetCommands,
      ctx.sourceCommands,
      ctx.rules,
      ctx.target.version,
    );
    const item: CrossVersionSyncItem = {
      kind: 'hotkey',
      ref,
      command: binding.command,
      decision: verdict.decision,
      reason: verdict.reason,
      askConfirm: verdict.askConfirm,
      sourceValue: binding,
      targetValue: target ?? undefined,
    };
    items.push(item);
  }

  // 目标独有（源没有的 key）
  for (const binding of targetBindings) {
    const ref = `${binding.type}:${binding.key}`;
    if (!seenTarget.has(ref)) {
      items.push({
        kind: 'hotkey',
        ref,
        command: binding.command,
        decision: 'keep_target',
        reason: '目标方案独有绑定，默认保留',
        sourceValue: {},
        targetValue: binding,
      });
    }
  }
  return items;
}

function matchTargetSkill(
  item: SkillProfileItem,
  targetItems: SkillProfileItem[],
): SkillProfileItem | null {
  const exact = targetItems.find((target) => target.skillId === item.skillId);
  if (exact) return exact;
  const scored = targetItems
    .map((target) => ({ target, score: scoreNameSimilarity(item.skillName || '', target.skillName || '') }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null; // 歧义：待确认
  return scored[0].target;
}

function alignSkill(
  sourceItems: SkillProfileItem[],
  targetItems: SkillProfileItem[],
  ctx: CrossVersionSyncInput,
): CrossVersionSyncItem[] {
  const items: CrossVersionSyncItem[] = [];
  const seenTarget = new Set<string>();

  for (const item of sourceItems) {
    const target = matchTargetSkill(item, targetItems);
    if (target) seenTarget.add(target.skillId);
    if (!target) {
      items.push({
        kind: 'skill',
        ref: item.skillId,
        command: item.skillName,
        decision: 'skip_ver',
        reason: `目标版本未找到 Skill「${item.skillName || item.sourceFile}」，仅源版本存在`,
        sourceValue: item,
      });
      continue;
    }
    items.push({
      kind: 'skill',
      ref: target.skillId,
      command: item.skillName,
      decision: 'sync',
      sourceValue: item,
      targetValue: target,
    });
  }

  for (const item of targetItems) {
    if (!seenTarget.has(item.skillId)) {
      items.push({
        kind: 'skill',
        ref: item.skillId,
        command: item.skillName,
        decision: 'keep_target',
        reason: '目标方案独有 Skill，默认保留',
        sourceValue: {},
        targetValue: item,
      });
    }
  }
  return items;
}

function menuPath(item: MenuItemConfig): string {
  return (item.path ?? []).join(' > ') || item.label;
}

function alignMenu(
  sourceItems: MenuItemConfig[],
  targetItems: MenuItemConfig[],
  ctx: CrossVersionSyncInput,
): CrossVersionSyncItem[] {
  const items: CrossVersionSyncItem[] = [];
  const seenTarget = new Set<string>();

  for (const item of sourceItems) {
    const path = menuPath(item);
    const target = targetItems.find((candidate) => menuPath(candidate) === path) ?? null;
    if (target) seenTarget.add(path);

    if (!item.command?.trim()) {
      // 子菜单 / 分隔线：布局无条件同步
      items.push({
        kind: 'menu',
        ref: path,
        command: '',
        decision: 'sync',
        sourceValue: item,
        targetValue: target ?? undefined,
      });
      continue;
    }

    const verdict = classifyCommand(
      item.command,
      ctx.targetCommands,
      ctx.sourceCommands,
      ctx.rules,
      ctx.target.version,
    );
    items.push({
      kind: 'menu',
      ref: path,
      command: item.command,
      decision: verdict.decision,
      reason: verdict.reason,
      askConfirm: verdict.askConfirm,
      sourceValue: item,
      targetValue: target ?? undefined,
    });
  }

  for (const item of targetItems) {
    const path = menuPath(item);
    if (!seenTarget.has(path)) {
      items.push({
        kind: 'menu',
        ref: path,
        command: item.command ?? '',
        decision: 'keep_target',
        reason: '目标方案独有菜单项，默认保留',
        sourceValue: {},
        targetValue: item,
      });
    }
  }
  return items;
}

/**
 * 生成跨版本同步计划。source/target 同名方案的方案各自为整体快照，
 * 分类结果用于 UI 确认与后续 mergeProfiles 合并。
 */
export function planCrossVersionSync(input: CrossVersionSyncInput): CrossVersionSyncPlan {
  const items: CrossVersionSyncItem[] = [];

  items.push(...alignHotkey(
    (input.sourceHotkey?.bindings ?? []).filter((binding) => binding.enabled !== false),
    (input.targetHotkey?.bindings ?? []).filter((binding) => binding.enabled !== false),
    input,
  ));
  items.push(...alignSkill(
    input.sourceSkill?.skillStates ?? [],
    input.targetSkill?.skillStates ?? [],
    input,
  ));
  items.push(...alignMenu(
    input.sourceMenu?.items ?? [],
    input.targetMenu?.items ?? [],
    input,
  ));

  const stats = { ...EMPTY_STATS };
  for (const item of items) bump(stats, item.decision);

  const hasSource = Boolean(input.sourceHotkey || input.sourceSkill || input.sourceMenu);
  const hasContent = items.length > 0;
  return {
    source: input.source,
    target: input.target,
    items,
    stats,
    blocked: !hasSource || !hasContent,
    notes: input.notes ?? [],
    blockedReason: !hasSource
      ? '源环境没有可同步的方案内容，请先选择方案'
      : !hasContent
        ? '源方案内容为空：请先在对应页面从当前环境构建并保存快捷键 / Skill / 菜单方案'
        : undefined,
  };
}
