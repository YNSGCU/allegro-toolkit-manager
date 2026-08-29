/**
 * ATM - 跨版本同步结果合并（V6.4，M3）
 *
 * 根据同步计划（仅处理 sync / user_force / keep_target；skip 类不写入），
 * 生成目标环境「新方案」内容（不落盘）。新方案独立命名，不覆盖现有方案。
 * 纯函数、可测试。
 */
import { generateMenuId } from '../menu/menuManager';
import { generateSkillProfileId } from '../../src/types/skillProfile';
import type {
  CrossVersionSyncItem,
  CrossVersionSyncPlan,
} from '../../src/types/sync';
import type { HotkeyProfile, HotkeyProfileBinding } from '../../src/types/hotkey';
import type { SkillProfile, SkillProfileItem } from '../../src/types/skillProfile';
import type { MenuItemConfig, MenuProfile } from '../../src/types/menu';

export interface MergeSyncInput {
  plan: CrossVersionSyncPlan;
  source?: {
    hotkey?: HotkeyProfile | null;
    skill?: SkillProfile | null;
    menu?: MenuProfile | null;
  };
  target?: {
    hotkey?: HotkeyProfile | null;
    skill?: SkillProfile | null;
    menu?: MenuProfile | null;
  };
  /** 新方案名称后缀，默认「（同步）」 */
  nameSuffix?: string;
}

export interface MergeSyncResult {
  hotkey?: HotkeyProfile;
  skill?: SkillProfile;
  menu?: MenuProfile;
}

const SYNCABLE: ReadonlySet<string> = new Set(['sync', 'user_force', 'keep_target']);

function splitRef(ref: string): { type: 'funckey' | 'alias'; key: string } {
  const separatorIndex = ref.indexOf(':');
  const type = ref.slice(0, separatorIndex) as 'funckey' | 'alias';
  return { type, key: ref.slice(separatorIndex + 1) };
}

function buildHotkeyBinding(
  item: CrossVersionSyncItem,
  sequence: number,
): HotkeyProfileBinding {
  const source = item.sourceValue as HotkeyProfileBinding | undefined;
  const target = item.targetValue as HotkeyProfileBinding | undefined;
  const { type, key } = splitRef(item.ref);
  return {
    id: target?.id ?? `sync_hk_${Date.now().toString(36)}_${sequence}`,
    key,
    command: source?.command ?? item.command,
    type,
    chineseName: source?.chineseName,
    commandSource: source?.commandSource,
    enabled: true,
    note: source?.note,
  };
}

function mergeHotkey(
  input: MergeSyncInput,
  items: CrossVersionSyncItem[],
): HotkeyProfile | undefined {
  const source = input.source?.hotkey;
  const target = input.target?.hotkey;
  if (!source) return undefined;

  const keepBindings = items
    .filter((item) => item.kind === 'hotkey' && item.decision === 'keep_target')
    .map((item) => item.targetValue as HotkeyProfileBinding)
    .filter((binding): binding is HotkeyProfileBinding => Boolean(binding));

  let sequence = 0;
  const syncedBindings = items
    .filter(
      (item) =>
        item.kind === 'hotkey' && (item.decision === 'sync' || item.decision === 'user_force'),
    )
    .map((item) => buildHotkeyBinding(item, ++sequence));

  const now = new Date().toISOString();
  return {
    id: `sync_hk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${source.name}${input.nameSuffix ?? '（同步）'}`,
    description: `由 ${source.name} 同步到 ${input.plan.target.version}（${now}）`,
    createdAt: now,
    updatedAt: now,
    bindings: [...syncedBindings, ...keepBindings],
    sourceEnvironmentId: input.plan.source.environmentId,
    sourceAllegroVersion: input.plan.source.version,
    testedAllegroVersions: [input.plan.target.version],
    targetCompatibility: target?.targetCompatibility,
  };
}

function mergeSkillItem(
  item: CrossVersionSyncItem,
): SkillProfileItem {
  const source = item.sourceValue as SkillProfileItem | undefined;
  const target = item.targetValue as SkillProfileItem | undefined;
  return {
    skillId: item.ref,
    skillName: target?.skillName ?? source?.skillName ?? item.command,
    sourceFile: target?.sourceFile ?? source?.sourceFile ?? '',
    enabled: source?.enabled ?? target?.enabled ?? true,
    loadEnabled: source?.loadEnabled ?? target?.loadEnabled ?? true,
    order: source?.order ?? target?.order ?? 0,
    note: source?.note ?? target?.note,
  };
}

function mergeSkill(
  input: MergeSyncInput,
  items: CrossVersionSyncItem[],
): SkillProfile | undefined {
  const source = input.source?.skill;
  const target = input.target?.skill;
  if (!source) return undefined;

  const synced = items.filter(
    (item) => item.kind === 'skill' && (item.decision === 'sync' || item.decision === 'user_force'),
  );
  const kept = items
    .filter((item) => item.kind === 'skill' && item.decision === 'keep_target')
    .map((item) => item.targetValue as SkillProfileItem)
    .filter((item): item is SkillProfileItem => Boolean(item));

  const syncedIds = new Set(synced.map((item) => item.ref));
  const keptIds = new Set(kept.map((item) => item.skillId));

  // 应用顺序：
  // 1) 源 loadOrder 中成功映射到目标 skillId 的项（保持源顺序）
  // 2) 同步项按源 skillStates 顺序兜底（源 loadOrder 为空或 ID 体系不同）
  // 3) 目标独有项追加在最后
  const loadOrder: string[] = [];
  for (const id of source.loadOrder ?? []) {
    if (syncedIds.has(id) && !loadOrder.includes(id)) loadOrder.push(id);
  }
  for (const item of synced) {
    if (!loadOrder.includes(item.ref)) loadOrder.push(item.ref);
  }
  for (const id of keptIds) {
    if (!loadOrder.includes(id)) loadOrder.push(id);
  }

  const now = new Date().toISOString();
  return {
    id: generateSkillProfileId(),
    name: `${source.name}${input.nameSuffix ?? '（同步）'}`,
    description: `由 ${source.name} 同步到 ${input.plan.target.version}（${now}）`,
    enabled: true,
    skillStates: [...synced.map(mergeSkillItem), ...kept],
    loadOrder,
    createdAt: now,
    updatedAt: now,
    sourceEnvironmentId: input.plan.source.environmentId,
    sourceAllegroVersion: input.plan.source.version,
    testedAllegroVersions: [input.plan.target.version],
    targetCompatibility: target?.targetCompatibility,
  };
}

function rebuildMenuNode(
  node: MenuItemConfig,
  decisionByPath: Map<string, string>,
): MenuItemConfig | null {
  const path = (node.path ?? []).join(' > ') || node.label;
  const decision = decisionByPath.get(path);
  if (decision === 'skip_ver' || decision === 'skip_unknown') return null;

  const children = (node.children ?? [])
    .map((child) => rebuildMenuNode(child, decisionByPath))
    .filter((child): child is MenuItemConfig => child !== null);

  return {
    ...node,
    id: generateMenuId(),
    children,
  };
}

function mergeMenu(
  input: MergeSyncInput,
  items: CrossVersionSyncItem[],
): MenuProfile | undefined {
  const source = input.source?.menu;
  const target = input.target?.menu;
  if (!source) return undefined;

  const decisionByPath = new Map<string, string>();
  for (const item of items) {
    if (item.kind !== 'menu') continue;
    decisionByPath.set(item.ref, item.decision);
  }

  const syncedNodes = (source.items ?? [])
    .map((node) => rebuildMenuNode(node, decisionByPath))
    .filter((node): node is MenuItemConfig => node !== null);

  const keptNodes = items
    .filter((item) => item.kind === 'menu' && item.decision === 'keep_target')
    .map((item) => item.targetValue as MenuItemConfig)
    .filter((node): node is MenuItemConfig => Boolean(node))
    .map((node) => rebuildMenuNode(node, decisionByPath))
    .filter((node): node is MenuItemConfig => node !== null);

  const now = new Date().toISOString();
  return {
    id: `sync_mn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${source.name}${input.nameSuffix ?? '（同步）'}`,
    description: `由 ${source.name} 同步到 ${input.plan.target.version}（${now}）`,
    enabled: true,
    items: [...syncedNodes, ...keptNodes],
    createdAt: now,
    updatedAt: now,
    sourceEnvironmentId: input.plan.source.environmentId,
    sourceAllegroVersion: input.plan.source.version,
    testedAllegroVersions: [input.plan.target.version],
    targetCompatibility: target?.targetCompatibility,
  };
}

/**
 * 合并同步结果为目标环境「新方案」。
 * 只消费 sync / user_force / keep_target；skip_ver / skip_unknown 不写入。
 */
export function mergeSyncProfiles(input: MergeSyncInput): MergeSyncResult {
  const items = input.plan.items;
  if (input.plan.blocked) return {};
  const result: MergeSyncResult = {};

  if (items.some((item) => item.kind === 'hotkey')) {
    const merged = mergeHotkey(input, items);
    if (merged) result.hotkey = merged;
  }
  if (items.some((item) => item.kind === 'skill')) {
    const merged = mergeSkill(input, items);
    if (merged) result.skill = merged;
  }
  if (items.some((item) => item.kind === 'menu')) {
    const merged = mergeMenu(input, items);
    if (merged) result.menu = merged;
  }
  return result;
}
