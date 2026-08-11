import type {
  MenuCommandSource,
  MenuItemConfig,
  MenuItemType,
  MenuProfile,
  MenuProfileImportFormat,
  MenuProfileImportPreview,
  MenuProfilePackage,
  MenuProfileStore,
} from '../../src/types/menu';
import {
  isPrintableAsciiMenuLabel,
  requiresAsciiMenuLabelCompatibility,
  validateMenuTree,
} from '../../src/types/menu';

export const MENU_PROFILE_PACKAGE_KIND = 'atm-menu-profile' as const;
export const MENU_PROFILE_PACKAGE_SCHEMA_VERSION = 1 as const;
export const MENU_PROFILE_PACKAGE_EXTENSION = 'atmmenu';

const MENU_ITEM_TYPES = new Set<MenuItemType>(['menu', 'command', 'separator']);
const COMMAND_SOURCES = new Set<MenuCommandSource>([
  'allegro_builtin',
  'user_skill',
  'atm_managed_skill',
  'company_skill',
  'unknown',
  'ambiguous',
]);
const MAX_MENU_ITEMS = 5000;

export interface ParsedMenuProfilePackage {
  package: MenuProfilePackage;
  format: MenuProfileImportFormat;
}

export interface MenuProfileImportOptions {
  targetEnvironmentId?: string | null;
  targetAllegroVersion?: string | null;
  filePath?: string;
  fileName?: string;
}

export interface ImportedMenuProfileResult {
  store: MenuProfileStore;
  profile: MenuProfile;
  preview: MenuProfileImportPreview;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function countItems(items: MenuItemConfig[]): number {
  return items.reduce((sum, item) => sum + 1 + countItems(Array.isArray(item.children) ? item.children : []), 0);
}

function stripLocalItemState(item: MenuItemConfig): MenuItemConfig {
  return {
    ...cloneJson(item),
    sourceSkillFile: undefined,
    issues: undefined,
    children: item.children?.map(stripLocalItemState),
  };
}

/** 创建便携方案包；不导出本机绝对 Skill 文件路径和运行时问题状态。 */
export function createMenuProfilePackage(
  profile: MenuProfile,
  source: MenuProfilePackage['source'] = {},
  exportedByVersion?: string,
): MenuProfilePackage {
  const validation = validateMenuTree(profile.items || []);
  if (validation.hasError) {
    throw new Error(`菜单方案存在结构错误，不能导出：${validation.errors.map(item => item.message).join('；')}`);
  }

  const portableProfile: MenuProfile = {
    ...cloneJson(profile),
    sourceEnvironmentId: undefined,
    targetCompatibility: profile.targetCompatibility
      ? { ...cloneJson(profile.targetCompatibility), intendedEnvironmentId: undefined }
      : undefined,
    items: (profile.items || []).map(stripLocalItemState),
  };

  return {
    kind: MENU_PROFILE_PACKAGE_KIND,
    schemaVersion: MENU_PROFILE_PACKAGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    exportedByVersion,
    source,
    profile: portableProfile,
  };
}

export function serializeMenuProfilePackage(profilePackage: MenuProfilePackage): string {
  return `${JSON.stringify(profilePackage, null, 2)}\n`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function selectProfileFromStore(store: Record<string, unknown>): MenuProfile | null {
  if (!Array.isArray(store.profiles)) return null;
  const profiles = store.profiles.filter(isObject) as unknown as MenuProfile[];
  const active = profiles.find(profile => profile.id === store.activeProfileId && countItems(profile.items || []) > 0);
  return active || profiles.find(profile => countItems(profile.items || []) > 0) || profiles[0] || null;
}

function assertPortableProfile(profile: unknown): asserts profile is MenuProfile {
  if (!isObject(profile)) throw new Error('方案包缺少有效的 profile 对象');
  if (typeof profile.name !== 'string' || !profile.name.trim()) throw new Error('菜单方案名称为空');
  if (!Array.isArray(profile.items)) throw new Error('菜单方案缺少 items 数组');
  let itemCount = 0;
  const assertItems = (items: unknown[], depth: number) => {
    if (depth > 32) throw new Error('菜单嵌套深度异常，拒绝导入');
    for (const item of items) {
      if (!isObject(item)) throw new Error('菜单项必须是 JSON 对象');
      if (typeof item.id !== 'string' || !item.id) throw new Error('菜单项缺少有效 ID');
      if (typeof item.label !== 'string') throw new Error(`菜单项 ${item.id} 缺少标签`);
      if (typeof item.type !== 'string' || !MENU_ITEM_TYPES.has(item.type as MenuItemType)) {
        throw new Error(`菜单项“${item.label}”类型无效`);
      }
      itemCount += 1;
      if (itemCount > MAX_MENU_ITEMS) throw new Error(`菜单项超过 ${MAX_MENU_ITEMS} 个，拒绝导入`);
      if (item.children !== undefined && !Array.isArray(item.children)) {
        throw new Error(`菜单项“${item.label}”的 children 必须是数组`);
      }
      if (Array.isArray(item.children)) assertItems(item.children, depth + 1);
    }
  };
  assertItems(profile.items, 1);
  if (itemCount > MAX_MENU_ITEMS) throw new Error(`菜单项超过 ${MAX_MENU_ITEMS} 个，拒绝导入`);

  const validation = validateMenuTree(profile.items as MenuItemConfig[]);
  if (validation.hasError) {
    throw new Error(`菜单方案结构无效：${validation.errors.map(item => item.message).join('；')}`);
  }
}

/** 解析 .atmmenu，也兼容单 Profile JSON 与旧 menu_profile.json 仓库。 */
export function parseMenuProfilePackage(content: string): ParsedMenuProfilePackage {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error('文件不是有效的 UTF-8 JSON');
  }
  if (!isObject(raw)) throw new Error('文件根节点必须是 JSON 对象');

  let format: MenuProfileImportFormat;
  let profile: MenuProfile | null = null;
  let source: MenuProfilePackage['source'] = {};
  let exportedAt = new Date().toISOString();
  let exportedByVersion: string | undefined;

  if (raw.kind === MENU_PROFILE_PACKAGE_KIND) {
    if (raw.schemaVersion !== MENU_PROFILE_PACKAGE_SCHEMA_VERSION) {
      throw new Error(`不支持的菜单方案包版本：${String(raw.schemaVersion)}`);
    }
    format = 'atm-menu-profile';
    profile = raw.profile as MenuProfile;
    source = isObject(raw.source) ? {
      environmentName: typeof raw.source.environmentName === 'string' ? raw.source.environmentName : undefined,
      allegroVersion: typeof raw.source.allegroVersion === 'string' || raw.source.allegroVersion === null
        ? raw.source.allegroVersion
        : undefined,
    } : {};
    exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : exportedAt;
    exportedByVersion = typeof raw.exportedByVersion === 'string' ? raw.exportedByVersion : undefined;
  } else if (Array.isArray(raw.profiles)) {
    format = 'menu-profile-store';
    profile = selectProfileFromStore(raw);
  } else {
    format = 'menu-profile';
    profile = raw as unknown as MenuProfile;
  }

  if (!profile) throw new Error('文件中没有可导入的菜单方案');
  assertPortableProfile(profile);
  if (source.allegroVersion === undefined && profile.sourceAllegroVersion !== undefined) {
    source.allegroVersion = profile.sourceAllegroVersion;
  }

  return {
    format,
    package: {
      kind: MENU_PROFILE_PACKAGE_KIND,
      schemaVersion: MENU_PROFILE_PACKAGE_SCHEMA_VERSION,
      exportedAt,
      exportedByVersion,
      source,
      profile: cloneJson(profile),
    },
  };
}

function uniqueImportedName(store: MenuProfileStore, sourceName: string): { name: string; conflict: boolean } {
  const names = new Set(store.profiles.map(profile => profile.name.trim().toLocaleLowerCase()));
  if (!names.has(sourceName.trim().toLocaleLowerCase())) return { name: sourceName, conflict: false };

  const base = `${sourceName}（导入）`;
  let name = base;
  let suffix = 2;
  while (names.has(name.trim().toLocaleLowerCase())) name = `${base} ${suffix++}`;
  return { name, conflict: true };
}

function normalizeCommandSource(value: unknown): MenuCommandSource | undefined {
  return typeof value === 'string' && COMMAND_SOURCES.has(value as MenuCommandSource)
    ? value as MenuCommandSource
    : undefined;
}

function normalizeImportedItems(
  items: MenuItemConfig[],
  now: string,
  parentId?: string,
  parentPath: string[] = [],
  sequence = { value: 0 },
): MenuItemConfig[] {
  return items.map((source, index) => {
    const type = MENU_ITEM_TYPES.has(source.type) ? source.type : 'command';
    const id = `menu_import_${Date.now()}_${sequence.value++}_${Math.random().toString(36).slice(2, 7)}`;
    const label = typeof source.label === 'string' ? source.label : '';
    const path = [...parentPath, label];
    const item: MenuItemConfig = {
      id,
      label,
      compatibilityLabel: typeof source.compatibilityLabel === 'string' ? source.compatibilityLabel : undefined,
      originalLabel: typeof source.originalLabel === 'string' ? source.originalLabel : undefined,
      description: typeof source.description === 'string' ? source.description : undefined,
      type,
      parentId,
      path,
      order: index,
      command: typeof source.command === 'string' ? source.command : undefined,
      commandSource: normalizeCommandSource(source.commandSource),
      sourceSkillId: typeof source.sourceSkillId === 'string' ? source.sourceSkillId : undefined,
      sourceSkillName: typeof source.sourceSkillName === 'string' ? source.sourceSkillName : undefined,
      hotkeys: Array.isArray(source.hotkeys) ? source.hotkeys.filter(value => typeof value === 'string') : undefined,
      menuSource: 'imported',
      enabled: source.enabled !== false,
      visible: source.visible !== false,
      status: 'normal',
      icon: typeof source.icon === 'string' ? source.icon : undefined,
      createdAt: now,
      updatedAt: now,
    };
    item.children = type === 'menu'
      ? normalizeImportedItems(source.children || [], now, id, path, sequence)
      : undefined;
    return item;
  });
}

function buildPreview(
  store: MenuProfileStore,
  parsed: ParsedMenuProfilePackage,
  options: MenuProfileImportOptions,
): MenuProfileImportPreview {
  const profile = parsed.package.profile;
  const name = uniqueImportedName(store, profile.name.trim());
  const allItems: MenuItemConfig[] = [];
  const walk = (items: MenuItemConfig[]) => items.forEach(item => {
    allItems.push(item);
    if (item.children) walk(item.children);
  });
  walk(profile.items || []);
  const commands = [...new Set(allItems
    .filter(item => item.type === 'command' && item.command?.trim())
    .map(item => item.command!.trim()))].sort();
  const compatibilityWarningCount = requiresAsciiMenuLabelCompatibility(options.targetAllegroVersion)
    ? allItems.filter(item => item.type !== 'separator'
      && item.enabled
      && item.visible
      && !isPrintableAsciiMenuLabel(item.label)
      && !isPrintableAsciiMenuLabel(item.compatibilityLabel)).length
    : 0;
  const warnings: string[] = [];
  if (parsed.format !== 'atm-menu-profile') warnings.push('检测到旧 JSON 格式，将只导入其中一个菜单方案。');
  if (name.conflict) warnings.push(`当前环境已有同名方案，导入后将命名为“${name.name}”。`);
  if (parsed.package.source.allegroVersion
    && options.targetAllegroVersion
    && parsed.package.source.allegroVersion !== options.targetAllegroVersion) {
    warnings.push(`来源 Allegro ${parsed.package.source.allegroVersion}，当前目标为 ${options.targetAllegroVersion}，应用前请检查命令兼容性。`);
  }
  if (compatibilityWarningCount > 0) {
    warnings.push(`${compatibilityWarningCount} 个中文菜单项缺少 17.2 英文兼容显示名，导入后需补齐才能应用。`);
  }
  if (commands.length > 0) warnings.push('方案包只包含菜单结构，不包含对应 Skill 文件；请确认另一台电脑已安装这些命令。');

  return {
    filePath: options.filePath || '',
    fileName: options.fileName || '',
    format: parsed.format,
    schemaVersion: parsed.package.schemaVersion,
    sourceProfileName: profile.name,
    proposedProfileName: name.name,
    itemCount: allItems.length,
    commandCount: commands.length,
    menuCount: allItems.filter(item => item.type === 'menu').length,
    separatorCount: allItems.filter(item => item.type === 'separator').length,
    sourceAllegroVersion: parsed.package.source.allegroVersion,
    targetAllegroVersion: options.targetAllegroVersion,
    nameConflict: name.conflict,
    compatibilityWarningCount,
    commands,
    warnings,
  };
}

export function previewMenuProfileImport(
  store: MenuProfileStore,
  parsed: ParsedMenuProfilePackage,
  options: MenuProfileImportOptions = {},
): MenuProfileImportPreview {
  return buildPreview(store, parsed, options);
}

/** 合并为一个新草稿；所有 Profile/菜单项 ID 重新生成，不覆盖现有方案。 */
export function importMenuProfilePackage(
  targetStore: MenuProfileStore,
  parsed: ParsedMenuProfilePackage,
  options: MenuProfileImportOptions = {},
): ImportedMenuProfileResult {
  const store = cloneJson(targetStore);
  const preview = buildPreview(store, parsed, options);
  const now = new Date().toISOString();
  const source = parsed.package.profile;
  const crossVersion = Boolean(parsed.package.source.allegroVersion
    && options.targetAllegroVersion
    && parsed.package.source.allegroVersion !== options.targetAllegroVersion);
  const profile: MenuProfile = {
    id: `profile_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: preview.proposedProfileName,
    description: source.description || `从 ${preview.fileName || '菜单方案包'} 导入`,
    enabled: source.enabled !== false,
    items: normalizeImportedItems(source.items || [], now),
    createdAt: now,
    updatedAt: now,
    sourceEnvironmentId: null,
    sourceAllegroVersion: parsed.package.source.allegroVersion ?? source.sourceAllegroVersion ?? null,
    testedAllegroVersions: Array.isArray(source.testedAllegroVersions)
      ? source.testedAllegroVersions.filter(value => typeof value === 'string')
      : [],
    targetCompatibility: {
      intendedEnvironmentId: options.targetEnvironmentId ?? null,
      intendedAllegroVersion: options.targetAllegroVersion ?? null,
      lastCheckedAt: now,
      lastVerdict: preview.compatibilityWarningCount > 0 || crossVersion ? 'warning' : 'portable',
    },
  };
  store.profiles.push(profile);
  store.activeProfileId = profile.id;
  store.updatedAt = now;
  return { store, profile, preview };
}

export function sanitizeMenuProfileFileName(name: string): string {
  const sanitized = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '');
  return sanitized || 'menu-profile';
}
