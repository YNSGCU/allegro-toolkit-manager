/**
 * ATM - 菜单管理模块（V5.5 可视化菜单编辑）
 *
 * 原则：
 * 1. 不直接修改 Allegro 原始菜单
 * 2. 不直接修改公司菜单
 * 3. 所有用户自定义菜单由 ATM 托管
 * 4. 菜单配置保存到 menu_profile.json（多 Profile 格式）
 * 5. generated_menu.il 由 menu_profile.json 生成
 * 6. 写文件操作必须通过 Apply Plan
 */
import fs from 'fs';
import path from 'path';
import type {
  MenuItemConfig,
  MenuProfile,
  MenuProfileStore,
  MenuItemCreateInput,
  MenuItemUpdateInput,
  MenuIssue,
  MenuItemType,
  MenuProfileRecoveryCandidate,
} from '../../src/types/menu';
import { validateMenuTree } from '../../src/types/menu';
import {
  isPrintableAsciiMenuLabel,
  requiresAsciiMenuLabelCompatibility,
} from '../../src/types/menu';
import type { ApplyPlanStepType } from '../../src/types/applyPlan';

// ═══════════════════════════════════════════════════
// 默认值
// ═══════════════════════════════════════════════════

const STORE_VERSION = '2.0';

/** 获取默认菜单方案 */
export function createDefaultProfile(): MenuProfile {
  const now = new Date().toISOString();
  return {
    id: 'default',
    name: '默认菜单方案',
    description: 'ATM 默认菜单方案',
    enabled: true,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** 获取空数据存储 */
export function createEmptyStore(): MenuProfileStore {
  const now = new Date().toISOString();
  return {
    version: STORE_VERSION,
    activeProfileId: 'default',
    profiles: [createDefaultProfile()],
    updatedAt: now,
  };
}

/** 生成菜单项 ID */
export function generateMenuId(): string {
  return `menu_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ═══════════════════════════════════════════════════
// 数据管理 — 兼容新旧两种格式
// ═══════════════════════════════════════════════════

/**
 * 加载 menu_profile.json（支持新旧两种格式）
 * 旧格式（V1）：{ profileVersion, menus } → 自动迁移
 * 新格式（V2）：{ version, activeProfileId, profiles }
 */
export function loadMenuProfileStore(atmGeneratedPath: string): MenuProfileStore {
  const profilePath = path.join(atmGeneratedPath, 'menu_profile.json');
  try {
    if (!fs.existsSync(profilePath)) {
      return createEmptyStore();
    }
    const raw = fs.readFileSync(profilePath, { encoding: 'utf-8' });
    const parsed = JSON.parse(raw);

    // 检测旧格式并迁移
    if (parsed.profileVersion && Array.isArray(parsed.menus)) {
      return migrateOldProfile(parsed);
    }

    // 新格式
    if (parsed.version && Array.isArray(parsed.profiles)) {
      return parsed as MenuProfileStore;
    }

    return createEmptyStore();
  } catch {
    return createEmptyStore();
  }
}

function countProfileItems(items: MenuItemConfig[]): number {
  return items.reduce((sum, item) => sum + 1 + countProfileItems(item.children || []), 0);
}

function normalizeRecoveryStore(parsed: unknown): MenuProfileStore | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<MenuProfileStore> & Partial<MenuProfile> & {
    profileVersion?: string;
    menus?: unknown[];
  };
  if (candidate.version && Array.isArray(candidate.profiles)) {
    return candidate as MenuProfileStore;
  }
  if (candidate.profileVersion && Array.isArray(candidate.menus)) {
    return migrateOldProfile(candidate);
  }
  if (candidate.id && candidate.name && Array.isArray(candidate.items)) {
    const store = createEmptyStore();
    const recovered = candidate as MenuProfile;
    store.profiles.push(recovered);
    store.activeProfileId = recovered.id;
    return store;
  }
  return null;
}

/**
 * 当前菜单仓库没有任何菜单项时，从 ATM 自身备份中寻找最新的非空方案。
 * 只返回只读候选，不修改 menu_profile.json；真正恢复必须经过 Apply Plan。
 */
export function findMenuProfileRecovery(
  atmGeneratedPath: string,
  currentStore = loadMenuProfileStore(atmGeneratedPath),
): MenuProfileRecoveryCandidate | null {
  if (currentStore.profiles.some(profile => countProfileItems(profile.items || []) > 0)) {
    return null;
  }

  const candidates: string[] = [];
  const collect = (directory: string) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (/^menu_profile\.json(?:\..+)?\.bak$/i.test(entry.name)) {
        candidates.push(path.join(directory, entry.name));
      }
    }
  };
  collect(atmGeneratedPath);
  collect(path.join(atmGeneratedPath, 'backups'));

  const recovered = candidates
    .map((backupPath) => {
      try {
        const parsed = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
        const store = normalizeRecoveryStore(parsed);
        if (!store) return null;
        const activeProfile = store.profiles.find(profile => profile.id === store.activeProfileId && countProfileItems(profile.items || []) > 0)
          ?? store.profiles.find(profile => countProfileItems(profile.items || []) > 0)
          ?? null;
        if (!activeProfile) return null;
        store.activeProfileId = activeProfile.id;
        const stat = fs.statSync(backupPath);
        return {
          backupPath,
          modifiedAt: stat.mtime.toISOString(),
          store,
          activeProfile,
          profileCount: store.profiles.filter(profile => countProfileItems(profile.items || []) > 0).length,
          itemCount: countProfileItems(activeProfile.items || []),
          mtimeMs: stat.mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is MenuProfileRecoveryCandidate & { mtimeMs: number } => Boolean(item))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

  if (!recovered) return null;
  const { mtimeMs: _mtimeMs, ...candidate } = recovered;
  return candidate;
}

/**
 * 将旧格式（V1）迁移到新格式
 */
function migrateOldProfile(old: any): MenuProfileStore {
  const now = new Date().toISOString();
  const items = migrateMenuItems(old.menus || []);
  const store = createEmptyStore();
  store.profiles[0].items = items;
  store.profiles[0].updatedAt = now;
  store.updatedAt = now;
  return store;
}

/**
 * 迁移旧菜单项到新 MenuItemConfig
 */
function migrateMenuItems(oldMenus: any[], parentId?: string): MenuItemConfig[] {
  return oldMenus.map((m: any, i: number) => {
    const id = m.id || generateMenuId();
    const children = m.submenu ? migrateMenuItems(m.submenu, id) : undefined;
    const hasChildren = children && children.length > 0;
    return {
      id,
      label: m.label || '',
      type: hasChildren ? 'menu' : (m.command ? 'command' : 'menu'),
      parentId,
      children,
      path: [],
      order: m.order ?? i,
      command: m.command,
      commandSource: m.source === 'company_skill' ? 'company_skill'
        : m.source === 'atm_managed' ? 'atm_managed_skill'
        : m.source === 'skill_package' ? 'user_skill'
        : undefined,
      menuSource: m.source || 'atm_managed',
      enabled: m.enabled !== false,
      visible: true,
      status: 'normal',
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    } as MenuItemConfig;
  });
}

/**
 * 保存 menu_profile.json
 */
export function saveMenuProfileStore(atmGeneratedPath: string, store: MenuProfileStore): boolean {
  const profilePath = path.join(atmGeneratedPath, 'menu_profile.json');
  const tmpPath = `${profilePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    if (!fs.existsSync(atmGeneratedPath)) {
      fs.mkdirSync(atmGeneratedPath, { recursive: true });
    }
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), { encoding: 'utf-8' });
    fs.renameSync(tmpPath, profilePath);
    return true;
  } catch {
    try {
      if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });
    } catch {
      // 临时文件清理失败不掩盖原始保存失败。
    }
    return false;
  }
}

/**
 * 加载当前激活的 Profile
 */
export function loadActiveProfile(atmGeneratedPath: string): MenuProfile | null {
  const store = loadMenuProfileStore(atmGeneratedPath);
  return store.profiles.find(p => p.id === store.activeProfileId) || store.profiles[0] || null;
}

/**
 * 获取菜单配置文件路径
 */
export function getMenuProfilePath(atmGeneratedPath: string): string {
  return path.join(atmGeneratedPath, 'menu_profile.json');
}

/**
 * 获取 generated_menu.il 路径
 */
export function getMenuIlPath(atmGeneratedPath: string): string {
  return path.join(atmGeneratedPath, 'generated_menu.il');
}

/**
 * 获取 bootstrap.il 路径
 */
export function getBootstrapPath(atmGeneratedPath: string): string {
  return path.join(atmGeneratedPath, 'bootstrap.il');
}

// ═══════════════════════════════════════════════════
// 树操作
// ═══════════════════════════════════════════════════

/**
 * 查找菜单项（递归）
 */
export function findMenuItemById(items: MenuItemConfig[], itemId: string): MenuItemConfig | undefined {
  for (const item of items) {
    if (item.id === itemId) return item;
    if (item.children) {
      const found = findMenuItemById(item.children, itemId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 查找父级菜单项
 */
export function findParentMenuItem(items: MenuItemConfig[], itemId: string): MenuItemConfig | undefined {
  for (const item of items) {
    if (item.children) {
      if (item.children.some(c => c.id === itemId)) return item;
      const found = findParentMenuItem(item.children, itemId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 计算菜单项的完整路径标签
 */
export function findMenuPath(profile: MenuProfile, itemId: string): string[] {
  const buildPath = (items: MenuItemConfig[], targetId: string, currentPath: string[]): string[] | null => {
    for (const item of items) {
      if (item.id === targetId) {
        return [...currentPath, item.label];
      }
      if (item.children) {
        const result = buildPath(item.children, targetId, [...currentPath, item.label]);
        if (result) return result;
      }
    }
    return null;
  };
  return buildPath(profile.items, itemId, []) || [];
}

/**
 * 添加菜单项
 */
export function addMenuItem(
  items: MenuItemConfig[],
  parentId: string | undefined,
  input: MenuItemCreateInput,
): { items: MenuItemConfig[]; created: MenuItemConfig } {
  const now = new Date().toISOString();
  const newItem: MenuItemConfig = {
    id: generateMenuId(),
    label: input.label || '',
    compatibilityLabel: input.compatibilityLabel,
    type: input.type || 'command',
    parentId,
    children: input.type === 'menu' ? [] : undefined,
    path: [],
    order: 0,
    command: input.command,
    commandSource: input.commandSource,
    sourceSkillId: input.sourceSkillId,
    sourceSkillName: input.sourceSkillName,
    sourceSkillFile: input.sourceSkillFile,
    menuSource: input.menuSource || 'atm_managed',
    enabled: input.enabled !== false,
    visible: input.visible !== false,
    status: 'normal',
    createdAt: now,
    updatedAt: now,
  };

  if (!parentId) {
    newItem.order = items.length;
    return { items: [...items, newItem], created: newItem };
  }

  const updated = structuredClone(items);
  const addToParent = (list: MenuItemConfig[]): boolean => {
    for (const item of list) {
      if (item.id === parentId) {
        if (!item.children) item.children = [];
        newItem.order = item.children.length;
        item.children.push(newItem);
        item.updatedAt = now;
        return true;
      }
      if (item.children) {
        if (addToParent(item.children)) return true;
      }
    }
    return false;
  };

  if (!addToParent(updated)) {
    // 父级不存在，加到顶级
    newItem.order = updated.length;
    newItem.parentId = undefined;
    return { items: [...updated, newItem], created: newItem };
  }

  return { items: updated, created: newItem };
}

/**
 * 更新菜单项
 */
export function updateMenuItem(
  items: MenuItemConfig[],
  itemId: string,
  updates: MenuItemUpdateInput,
): MenuItemConfig | null {
  const now = new Date().toISOString();
  const doUpdate = (list: MenuItemConfig[]): boolean => {
    for (const item of list) {
      if (item.id === itemId) {
        if (updates.label !== undefined) item.label = updates.label;
        if (updates.compatibilityLabel !== undefined) item.compatibilityLabel = updates.compatibilityLabel;
        if (updates.type !== undefined) {
          item.type = updates.type;
          if (updates.type === 'menu' && !item.children) item.children = [];
          if (updates.type !== 'menu') item.children = undefined;
        }
        if (updates.command !== undefined) item.command = updates.command;
        if (updates.commandSource !== undefined) item.commandSource = updates.commandSource;
        if (updates.sourceSkillId !== undefined) item.sourceSkillId = updates.sourceSkillId;
        if (updates.sourceSkillName !== undefined) item.sourceSkillName = updates.sourceSkillName;
        if (updates.sourceSkillFile !== undefined) item.sourceSkillFile = updates.sourceSkillFile;
        if (updates.menuSource !== undefined) item.menuSource = updates.menuSource;
        if (updates.enabled !== undefined) item.enabled = updates.enabled;
        if (updates.visible !== undefined) item.visible = updates.visible;
        if (updates.icon !== undefined) item.icon = updates.icon;
        item.updatedAt = now;
        return true;
      }
      if (item.children) {
        if (doUpdate(item.children)) return true;
      }
    }
    return false;
  };
  doUpdate(items);
  return findMenuItemById(items, itemId) || null;
}

/**
 * 删除菜单项
 */
export function deleteMenuItem(items: MenuItemConfig[], itemId: string): MenuItemConfig[] {
  const now = new Date().toISOString();
  const doDelete = (list: MenuItemConfig[]): MenuItemConfig[] => {
    const idx = list.findIndex(i => i.id === itemId);
    if (idx >= 0) {
      list.splice(idx, 1);
      // 重排 order
      list.forEach((item, i) => { item.order = i; item.updatedAt = now; });
      return list;
    }
    for (const item of list) {
      if (item.children) {
        item.children = doDelete(item.children);
      }
    }
    return list;
  };
  return doDelete([...items]);
}

/**
 * 复制菜单项
 */
export function duplicateMenuItem(items: MenuItemConfig[], itemId: string): MenuItemConfig | null {
  const source = findMenuItemById(items, itemId);
  if (!source) return null;
  const now = new Date().toISOString();

  const clone = (item: MenuItemConfig): MenuItemConfig => ({
    ...JSON.parse(JSON.stringify(item)),
    id: generateMenuId(),
    label: `${item.label} (副本)`,
    path: [],
    createdAt: now,
    updatedAt: now,
  });

  const created = clone(source);
  // 插入到源项后面
  const doInsert = (list: MenuItemConfig[]): boolean => {
    const idx = list.findIndex(i => i.id === itemId);
    if (idx >= 0) {
      created.order = idx + 1;
      list.splice(idx + 1, 0, created);
      // 重排后续 order
      for (let i = idx + 2; i < list.length; i++) {
        list[i].order = i;
      }
      return true;
    }
    for (const item of list) {
      if (item.children && doInsert(item.children)) return true;
    }
    return false;
  };
  const updated = [...items];
  doInsert(updated);
  return created;
}

/**
 * 上移菜单项
 */
export function moveMenuItemUp(items: MenuItemConfig[], itemId: string): MenuItemConfig[] {
  const now = new Date().toISOString();
  const doMove = (list: MenuItemConfig[]): boolean => {
    const idx = list.findIndex(i => i.id === itemId);
    if (idx > 0) {
      [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
      list.forEach((item, i) => { item.order = i; item.updatedAt = now; });
      return true;
    }
    for (const item of list) {
      if (item.children && doMove(item.children)) return true;
    }
    return false;
  };
  const updated = [...items];
  doMove(updated);
  return updated;
}

/**
 * 下移菜单项
 */
export function moveMenuItemDown(items: MenuItemConfig[], itemId: string): MenuItemConfig[] {
  const now = new Date().toISOString();
  const doMove = (list: MenuItemConfig[]): boolean => {
    const idx = list.findIndex(i => i.id === itemId);
    if (idx >= 0 && idx < list.length - 1) {
      [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
      list.forEach((item, i) => { item.order = i; item.updatedAt = now; });
      return true;
    }
    for (const item of list) {
      if (item.children && doMove(item.children)) return true;
    }
    return false;
  };
  const updated = [...items];
  doMove(updated);
  return updated;
}

/**
 * 扁平化菜单树（用于搜索/筛选）
 */
export function flattenMenuTree(items: MenuItemConfig[]): MenuItemConfig[] {
  const result: MenuItemConfig[] = [];
  const walk = (list: MenuItemConfig[]) => {
    for (const item of list) {
      result.push(item);
      if (item.children) walk(item.children);
    }
  };
  walk(items);
  return result;
}

/**
 * 更新所有菜单项的 path 字段
 */
export function rebuildMenuPaths(items: MenuItemConfig[], parentPath: string[] = []): MenuItemConfig[] {
  return items.map((item, i) => {
    const currentPath = [...parentPath, item.label];
    const children = item.children ? rebuildMenuPaths(item.children, currentPath) : undefined;
    return {
      ...item,
      path: currentPath,
      order: i,
      children,
    };
  });
}

// ═══════════════════════════════════════════════════
// Profile 管理
// ═══════════════════════════════════════════════════

/**
 * 获取所有 Profile
 */
export function listProfiles(store: MenuProfileStore): MenuProfile[] {
  return store.profiles;
}

/**
 * 获取当前激活的 Profile
 */
export function getActiveProfile(store: MenuProfileStore): MenuProfile | null {
  return store.profiles.find(p => p.id === store.activeProfileId) || store.profiles[0] || null;
}

/**
 * 将其他 Allegro 环境中的非空活动菜单方案复制到当前环境仓库。
 * 只构造新的源 JSON；真正写入由调用方生成可信 Apply Plan。
 */
export function copyMenuProfileStoreFromEnvironment(
  targetStore: MenuProfileStore,
  sourceStore: MenuProfileStore,
  sourceEnvironment: { id: string; version?: string | null; name?: string },
): { store: MenuProfileStore; profile: MenuProfile } {
  const sourceProfile = sourceStore.profiles.find(
    item => item.id === sourceStore.activeProfileId && countProfileItems(item.items || []) > 0,
  ) ?? sourceStore.profiles.find(item => countProfileItems(item.items || []) > 0);
  if (!sourceProfile) throw new Error('来源环境没有可复制的菜单项');

  const store = JSON.parse(JSON.stringify(targetStore)) as MenuProfileStore;
  const now = new Date().toISOString();
  const baseName = `${sourceProfile.name}（来自 ${sourceEnvironment.version || sourceEnvironment.name || '其他环境'}）`;
  const existingNames = new Set(store.profiles.map(item => item.name));
  let name = baseName;
  let suffix = 2;
  while (existingNames.has(name)) name = `${baseName} ${suffix++}`;

  const profile: MenuProfile = {
    ...JSON.parse(JSON.stringify(sourceProfile)),
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    sourceEnvironmentId: sourceEnvironment.id,
    sourceAllegroVersion: sourceEnvironment.version ?? null,
    testedAllegroVersions: sourceEnvironment.version ? [sourceEnvironment.version] : [],
    createdAt: now,
    updatedAt: now,
  };
  store.profiles.push(profile);
  store.activeProfileId = profile.id;
  store.updatedAt = now;
  return { store, profile };
}

/**
 * 切换当前 Profile
 */
export function setActiveProfile(store: MenuProfileStore, profileId: string): MenuProfileStore {
  if (store.profiles.some(p => p.id === profileId)) {
    store.activeProfileId = profileId;
  }
  return store;
}

/**
 * 新建 Profile
 */
export function createProfile(store: MenuProfileStore, name: string, description?: string): MenuProfileStore {
  const now = new Date().toISOString();
  const newProfile: MenuProfile = {
    id: `profile_${Date.now()}`,
    name,
    description: description || '',
    enabled: true,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  store.profiles.push(newProfile);
  return store;
}

/**
 * 复制 Profile
 */
export function copyProfile(store: MenuProfileStore, profileId: string, newName?: string): MenuProfileStore {
  const source = store.profiles.find(p => p.id === profileId);
  if (!source) return store;
  const now = new Date().toISOString();
  const copy: MenuProfile = {
    ...JSON.parse(JSON.stringify(source)),
    id: `profile_${Date.now()}`,
    name: newName || `${source.name} (副本)`,
    createdAt: now,
    updatedAt: now,
  };
  store.profiles.push(copy);
  return store;
}

/**
 * 重命名 Profile
 */
export function renameProfile(store: MenuProfileStore, profileId: string, newName: string): MenuProfileStore {
  const profile = store.profiles.find(p => p.id === profileId);
  if (profile) {
    profile.name = newName;
    profile.updatedAt = new Date().toISOString();
  }
  return store;
}

/**
 * 删除 Profile
 */
export function deleteProfile(store: MenuProfileStore, profileId: string): MenuProfileStore {
  if (store.profiles.length <= 1) return store; // 至少保留一个
  store.profiles = store.profiles.filter(p => p.id !== profileId);
  if (store.activeProfileId === profileId) {
    store.activeProfileId = store.profiles[0].id;
  }
  return store;
}

// ═══════════════════════════════════════════════════
// IL 生成
// ═══════════════════════════════════════════════════

/**
 * 从 Profile 生成 generated_menu.il 内容
 */
export interface MenuIlGenerationOptions {
  allegroVersion?: string | null;
}

export function generateMenuIlContent(
  profile: MenuProfile,
  options: MenuIlGenerationOptions = {},
): string {
  const validation = validateMenuTree(profile.items);
  if (validation.hasError) {
    throw new Error(validation.errors.map(issue => issue.message).join('；'));
  }

  const rootItems = profile.items.filter(
    item => !item.parentId && item.type === 'menu' && item.enabled && item.visible,
  );

  // Allegro 的菜单栈最多支持 8 层。先生成插入语句也能在返回预览前完成深度校验。
  const rootInsertBlocks = rootItems.map(item => generateRootMenuInsertLines(item, options));
  const lines: string[] = [
    ';; ========================================================',
    ';; ATM Generated Menu Loader',
    ';; Auto-generated by ATM (Allegro Toolkit Manager)',
    ';; Version: V5.6',
    `;; Generated at: ${new Date().toISOString()}`,
    `;; Menu profile: ${sanitizeSkillComment(profile.name)}`,
    ';;',
    ';; Do not edit this file manually.',
    ';; Use the ATM menu editor to make changes.',
    ';; ========================================================',
    '',
    ";; Track ATM top-level menu IDs for safe in-session reload",
    "unless(boundp('atmMenuIds)",
    '  atmMenuIds = nil',
    ')',
    '',
    ';; ========================================================',
    ';; Delete menus created by ATM in the current session',
    ';; ========================================================',
    'procedure(atmDeleteMenus()',
    '  foreach(atmMenuId atmMenuIds',
    '    when(atmMenuId',
    '      axlUIMenuDelete(atmMenuId)',
    '    )',
    '  )',
    '  atmMenuIds = nil',
    '  t',
    ')',
    '',
    ';; ========================================================',
    ';; Build menus with the official Find/Insert API',
    ';; ========================================================',
    'procedure(atmBuildMenus()',
    '  let((atmAnchor atmTopMenuId)',
  ];

  for (const block of rootInsertBlocks) {
    lines.push(...block);
  }

  if (rootItems.length === 0) {
    lines.push('    ;; No enabled and visible top-level menus in this profile');
  }

  lines.push('    t');
  lines.push('  )');
  lines.push(')');
  lines.push('');
  lines.push(';; ========================================================');
  lines.push(';; Manual reload command: delete ATM menus, then rebuild');
  lines.push(';; ========================================================');
  lines.push('procedure(atmLoadMenus()');
  lines.push('  atmDeleteMenus()');
  lines.push('  atmBuildMenus()');
  lines.push(`  printf("ATM: menu loaded (${rootItems.length} top-level menus)\\n")`);
  lines.push('  t');
  lines.push(')');
  lines.push('');
  lines.push(';; ========================================================');
  lines.push(';; Re-insert ATM menus whenever Allegro loads a new main menu');
  lines.push(';; ========================================================');
  lines.push('procedure(atmMenuOnLoad(atmMenuName)');
  lines.push('  ;; Old menuIds are invalid after a new main menu loads; skip delete');
  lines.push('  atmMenuIds = nil');
  lines.push('  atmBuildMenus()');
  lines.push('  t');
  lines.push(')');
  lines.push('');
  lines.push("  ;; When this file is reloaded, undo ATM's own previous registration");
  lines.push("when(isCallable('axlCmdUnregister)");
  lines.push('  axlCmdUnregister("atmLoadMenus")');
  lines.push(')');
  lines.push('axlCmdRegister("atmLoadMenus" \'atmLoadMenus ?cmdType "general")');
  lines.push("when(isCallable('axlTriggerClear)");
  lines.push("  axlTriggerClear('menu 'atmMenuOnLoad)");
  lines.push(')');
  lines.push("axlTriggerSet('menu 'atmMenuOnLoad)");
  lines.push('');
  lines.push(';; Install once when bootstrap loads this file; run atmLoadMenus to reload safely');
  lines.push("when(isCallable('axlUIMenuFind)");
  lines.push('  atmLoadMenus()');
  lines.push(')');
  lines.push('');
  lines.push(';; ========================================================');
  lines.push(';; End of Generated Menu');
  lines.push(';; ========================================================');
  lines.push('');

  return lines.join('\n');
}

/**
 * 生成一个顶级菜单的 Find/Insert 语句。
 */
function generateRootMenuInsertLines(
  item: MenuItemConfig,
  options: MenuIlGenerationOptions,
): string[] {
  assertMenuDepth(item, 1);

  const label = escapeSkillString(resolveMenuDisplayLabel(item, options));
  const lines = [
    '    atmAnchor = axlUIMenuFind(nil -1)',
    '    if(atmAnchor then',
    `      atmTopMenuId = axlUIMenuInsert(atmAnchor 'popup "${label}")`,
    '      when(atmTopMenuId',
    '        atmMenuIds = cons(atmTopMenuId atmMenuIds)',
  ];

  for (const child of item.children ?? []) {
    lines.push(...generateChildMenuInsertLines(child, 2, 4, options));
  }

  lines.push("        axlUIMenuInsert(nil 'end)");
  lines.push('      )');
  lines.push('    else');
  lines.push('      printf("ATM: main menu anchor not found; skipped one menu\\n")');
  lines.push('    )');

  return lines;
}

/**
 * 递归生成子菜单、命令项和分隔线的插入语句。
 */
function generateChildMenuInsertLines(
  item: MenuItemConfig,
  menuDepth: number,
  indentLevel: number,
  options: MenuIlGenerationOptions,
): string[] {
  if (!item.enabled || !item.visible) return [];

  const indent = '  '.repeat(indentLevel);
  const label = item.type === 'separator'
    ? ''
    : escapeSkillString(resolveMenuDisplayLabel(item, options));

  if (item.type === 'separator') {
    return [`${indent}axlUIMenuInsert(nil 'separator)`];
  }

  if (item.type === 'command') {
    if (!item.command) return [];
    return [`${indent}axlUIMenuInsert(nil "${label}" "${escapeSkillString(item.command)}")`];
  }

  assertMenuDepth(item, menuDepth);
  const lines = [`${indent}when(axlUIMenuInsert(nil 'popup "${label}")`];
  for (const child of item.children ?? []) {
    lines.push(...generateChildMenuInsertLines(child, menuDepth + 1, indentLevel + 1, options));
  }
  lines.push(`${indent}  axlUIMenuInsert(nil 'end)`);
  lines.push(`${indent})`);
  return lines;
}

/** 根据目标 Allegro 版本选择实际写入 axlUIMenuInsert 的显示标签。 */
export function resolveMenuDisplayLabel(
  item: Pick<MenuItemConfig, 'label' | 'compatibilityLabel'>,
  options: MenuIlGenerationOptions = {},
): string {
  if (!requiresAsciiMenuLabelCompatibility(options.allegroVersion)) return item.label;
  if (isPrintableAsciiMenuLabel(item.label)) return item.label;
  if (isPrintableAsciiMenuLabel(item.compatibilityLabel)) return item.compatibilityLabel!.trim();

  throw new Error(
    `菜单“${item.label}”在 Allegro ${options.allegroVersion || '17.2'} 中需要填写仅含英文/ASCII 的兼容显示名`,
  );
}

/** Allegro axlUIMenuInsert 的菜单栈最大深度为 8。 */
function assertMenuDepth(item: MenuItemConfig, menuDepth: number): void {
  if (!item.enabled || !item.visible || item.type !== 'menu') return;
  if (menuDepth > 8) {
    throw new Error(`菜单“${item.label}”超过 Allegro 限制：最多支持 8 层菜单`);
  }
  for (const child of item.children ?? []) {
    if (child.type === 'menu') assertMenuDepth(child, menuDepth + 1);
  }
}

/**
 * 转义 SKILL 字符串
 */
function escapeSkillString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

/** 防止方案名中的换行或非 ASCII 字符破坏生成文件注释（17.2 旧版 SKILL 需纯 ASCII）。 */
function sanitizeSkillComment(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/[^\x20-\x7e]/g, '?');
}

// ═══════════════════════════════════════════════════
// Bootstrap 管理
// ═══════════════════════════════════════════════════

/**
 * 检查 bootstrap.il 是否加载了 generated_menu.il
 */
export function checkBootstrapMenuLoad(atmGeneratedPath: string): { needsUpdate: boolean; reason: string } {
  const bootstrapPath = getBootstrapPath(atmGeneratedPath);
  if (!fs.existsSync(bootstrapPath)) {
    return { needsUpdate: true, reason: 'bootstrap.il 不存在' };
  }
  const content = fs.readFileSync(bootstrapPath, { encoding: 'utf-8' });
  const hasMenuLoader = content.includes(generateBootstrapMenuLoadLine(atmGeneratedPath));
  return {
    needsUpdate: !hasMenuLoader,
    reason: hasMenuLoader ? '已包含菜单加载' : '未包含菜单加载',
  };
}

/**
 * 生成确保 bootstrap 加载菜单的代码片段
 */
export function generateBootstrapMenuLoadLine(atmGeneratedPath: string): string {
  const normalizedPath = atmGeneratedPath.replace(/\\/g, '/');
  const menuIlPath = escapeSkillString(`${normalizedPath}/generated_menu.il`);
  return `load("${menuIlPath}")  ;; ATM: load menus`;
}

/** 确保 bootstrap 使用确定路径加载菜单，并替换旧版 getSkillPath/strcat 写法。 */
export function ensureBootstrapMenuLoad(
  currentContent: string,
  atmGeneratedPath: string,
): string {
  const menuLoadLine = generateBootstrapMenuLoadLine(atmGeneratedPath);
  const output: string[] = [];
  let inserted = false;

  for (const line of currentContent.replace(/\r\n/g, '\n').split('\n')) {
    if (line.includes('generated_menu.il')) {
      if (!inserted) output.push(menuLoadLine);
      inserted = true;
      continue;
    }
    output.push(line);
  }

  while (output.length > 0 && output[output.length - 1] === '') output.pop();
  if (!inserted) output.push(menuLoadLine);
  return `${output.join('\n')}\n`;
}

/**
 * 检查是否需要插入 bootstrap 行
 */
export function generateBootstrapMenuLoadPlan(atmGeneratedPath: string): {
  needsInsert: boolean;
  line: string;
} {
  const result = checkBootstrapMenuLoad(atmGeneratedPath);
  return {
    needsInsert: result.needsUpdate,
    line: generateBootstrapMenuLoadLine(atmGeneratedPath),
  };
}

// ═══════════════════════════════════════════════════
// Apply Plan 步骤生成
// ═══════════════════════════════════════════════════

/**
 * 获取菜单 Apply Plan 步骤
 */
export function getMenuApplyPlanSteps(
  profilePath: string,
  menuIlPath: string,
  profile: MenuProfile,
  store: MenuProfileStore,
  options: MenuIlGenerationOptions = {},
): Array<{
  type: ApplyPlanStepType;
  title: string;
  description: string;
  targetFile: string;
  before?: string;
  after?: string;
}> {
  const menuIl = generateMenuIlContent(profile, options);
  const activeItems = profile.items.filter(i => i.enabled);
  const itemCount = countMenuItems(profile.items);
  const appliedStore: MenuProfileStore = {
    ...store,
    appliedProfileId: profile.id,
    appliedAt: new Date().toISOString(),
  };

  return [
    {
      type: 'backup_file',
      title: '备份菜单配置',
      description: `备份 menu_profile.json`,
      targetFile: profilePath,
    },
    {
      type: 'update_json',
      title: '更新菜单配置文件',
      description: `保存菜单配置（${itemCount.total} 个菜单项，${itemCount.commands} 个命令）`,
      targetFile: profilePath,
      after: JSON.stringify(appliedStore, null, 2),
    },
    {
      type: 'generate_menu',
      title: '生成菜单注入脚本',
      description: `生成 generated_menu.il（${activeItems.length} 个激活菜单项）`,
      targetFile: menuIlPath,
      after: menuIl,
    },
  ];
}

/**
 * 统计菜单项数量
 */
export function countMenuItems(items: MenuItemConfig[]): { total: number; commands: number; menus: number; separators: number } {
  let total = 0, commands = 0, menus = 0, separators = 0;
  const walk = (list: MenuItemConfig[]) => {
    for (const item of list) {
      total++;
      if (item.type === 'command') commands++;
      else if (item.type === 'menu') menus++;
      else if (item.type === 'separator') separators++;
      if (item.children) walk(item.children);
    }
  };
  walk(items);
  return { total, commands, menus, separators };
}

/**
 * 获取 Apply Plan 风险信息
 */
export function getMenuApplyPlanRisks(
  profile: MenuProfile,
  options: MenuIlGenerationOptions = {},
): Array<{
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
}> {
  const risks: Array<{ severity: 'info' | 'warning' | 'error'; title: string; description: string }> = [];
  const allItems = flattenMenuTree(profile.items);
  const riskItems = allItems.filter((i: MenuItemConfig) => i.type === 'command' && !i.command);
  if (riskItems.length > 0) {
    risks.push({
      severity: 'error',
      title: '部分命令菜单项未绑定命令',
      description: `${riskItems.length} 个命令菜单项没有绑定命令，必须绑定后才能应用`,
    });
  }

  // 只读来源
  const readonlyItems = allItems.filter(i => i.menuSource === 'company_menu' || i.menuSource === 'allegro_default');
  if (readonlyItems.length > 0) {
    risks.push({
      severity: 'info',
      title: '包含只读来源菜单项',
      description: `${readonlyItems.length} 个菜单项来自只读来源，修改可能不会被保存`,
    });
  }

  if (requiresAsciiMenuLabelCompatibility(options.allegroVersion)) {
    const compatibilityItems = allItems.filter(item =>
      item.type !== 'separator'
      && item.enabled
      && item.visible
      && !isPrintableAsciiMenuLabel(item.label),
    );
    if (compatibilityItems.length > 0) {
      risks.push({
        severity: 'info',
        title: '已启用 Allegro 17.2 英文兼容显示',
        description: `${compatibilityItems.length} 个中文菜单项将在 Allegro 中显示英文兼容名，ATM 方案仍保留中文原名`,
      });
    }
  }

  // 通用提示
  risks.push({
    severity: 'info',
    title: '需要重启 Allegro 或重新加载菜单',
    description: '菜单修改需要重启 Allegro 或在 Allegro 命令窗口执行 "atmLoadMenus" 后生效',
  });

  return risks;
}

// ═══════════════════════════════════════════════════
// 菜单生效状态检查
// ═══════════════════════════════════════════════════

export interface MenuFileStatus {
  profileExists: boolean;
  ilExists: boolean;
  bootstrapHasMenu: boolean;
  ilInitHasBootstrap: boolean;
  ilInitPath: string | null;
}

/**
 * 检查菜单文件状态
 */
export function checkMenuFileStatus(atmGeneratedPath: string, pcbenvPath: string): MenuFileStatus {
  const profilePath = path.join(atmGeneratedPath, 'menu_profile.json');
  const ilPath = path.join(atmGeneratedPath, 'generated_menu.il');
  const bootstrapPath = path.join(atmGeneratedPath, 'bootstrap.il');

  const profileExists = fs.existsSync(profilePath);
  const ilExists = fs.existsSync(ilPath);

  // bootstrap 是否加载 generated_menu.il
  let bootstrapHasMenu = false;
  if (fs.existsSync(bootstrapPath)) {
    const content = fs.readFileSync(bootstrapPath, { encoding: 'utf-8' }).toLowerCase();
    bootstrapHasMenu = content.includes('generated_menu.il');
  }

  // allegro.ilinit 是否有 ATM bootstrap
  let ilInitHasBootstrap = false;
  let ilInitPath: string | null = null;
  const ilInitCandidates = [
    path.join(pcbenvPath, 'allegro.ilinit'),
    path.join(pcbenvPath, 'allegro.init'),
  ];
  for (const candidate of ilInitCandidates) {
    if (fs.existsSync(candidate)) {
      ilInitPath = candidate;
      const content = fs.readFileSync(candidate, { encoding: 'utf-8' }).toLowerCase();
      ilInitHasBootstrap = content.includes('bootstrap.il');
      break;
    }
  }

  return { profileExists, ilExists, bootstrapHasMenu, ilInitHasBootstrap, ilInitPath };
}

// ═══════════════════════════════════════════════════
// 从 CommandIndex 生成推荐菜单
// ═══════════════════════════════════════════════════

export interface RecommendMenuInput {
  commandName: string;
  chineseName?: string;
  sourceSkillName?: string;
  sourceSkillId?: string;
  sourceSkillFile?: string;
  sourceType?: string;
  entryType?: string;
  hotkeys?: string[];
  skillLoaded?: boolean;
  menuPaths?: string[];
  tags?: string[];
  autoCategory?: string;
  autoSummary?: string;
}

/** 分类规则 */
const CATEGORY_RULES: Array<{ keywords: string[]; category: string; subCategory: string }> = [
  { keywords: ['snap', 'pick', 'cursor', 'point', 'xy', 'coord'], category: '辅助工具', subCategory: '精准定位' },
  { keywords: ['grid'], category: '辅助工具', subCategory: '网格设置' },
  { keywords: ['unit', 'mil', 'mm', 'switch'], category: '辅助工具', subCategory: '单位切换' },
  { keywords: ['shape', 'copper', 'cut', 'crop', 'trim'], category: 'Shape 工具', subCategory: '' },
  { keywords: ['route', 'trace', 'connect', 'line', 'distribute', 'fanout'], category: '布线辅助', subCategory: '' },
  { keywords: ['via', 'pin', 'pad', 'net', 'netlist'], category: '网络/过孔', subCategory: '' },
  { keywords: ['text', 'label', 'silkscreen', 'silk'], category: '文字/标注', subCategory: '' },
  { keywords: ['check', 'drc', 'report', 'audit', 'verify'], category: '检查/报告', subCategory: '' },
  { keywords: ['align', 'arrange', 'stack', 'group'], category: '布局工具', subCategory: '' },
  { keywords: ['diff', 'compare', 'export', 'import', 'outline'], category: '导入/导出', subCategory: '' },
  { keywords: ['symbol', 'padstack', 'footprint'], category: '封装工具', subCategory: '' },
  { keywords: ['cross', 'probe', 'highlight', 'dehighlight'], category: '交互/定位', subCategory: '' },
  { keywords: ['edit', 'delete', 'change', 'copy', 'move', 'mirror', 'rotate'], category: '编辑工具', subCategory: '' },
  { keywords: ['property', 'prop', 'attribute', 'attr'], category: '属性工具', subCategory: '' },
  { keywords: ['layer', 'stack', 'cross', 'drill'], category: '层叠/钻孔', subCategory: '' },
];

/** 中文关键词映射 */
const CHINESE_KEYWORD_MAP: Array<{ keywords: string[]; category: string; subCategory: string }> = [
  { keywords: ['吸附', '捕捉', 'snap'], category: '辅助工具', subCategory: '精准定位' },
  { keywords: ['网格', 'grid'], category: '辅助工具', subCategory: '网格设置' },
  { keywords: ['单位', '切换', 'unit', 'mil', 'mm'], category: '辅助工具', subCategory: '单位切换' },
  { keywords: ['shape', '铜皮', '裁剪', 'cut'], category: 'Shape 工具', subCategory: '' },
  { keywords: ['布线', 'route', 'connect', '走线', '等距'], category: '布线辅助', subCategory: '' },
  { keywords: ['过孔', 'via', '焊盘', 'pin', '网络', 'net'], category: '网络/过孔', subCategory: '' },
  { keywords: ['文字', 'text', '标注', 'label'], category: '文字/标注', subCategory: '' },
  { keywords: ['检查', 'check', 'drc', '报告', 'report'], category: '检查/报告', subCategory: '' },
  { keywords: ['对齐', 'align', '布局'], category: '布局工具', subCategory: '' },
  { keywords: ['导入', '导出', 'import', 'export'], category: '导入/导出', subCategory: '' },
  { keywords: ['封装', 'symbol', 'padstack'], category: '封装工具', subCategory: '' },
  { keywords: ['高亮', 'highlight', 'probe', '定位', 'cross'], category: '交互/定位', subCategory: '' },
];

/**
 * 根据命令名/中文名分类
 */
export function classifyCommand(
  commandName: string,
  chineseName?: string,
  autoCategory?: string,
  tags?: string[],
): { category: string; subCategory: string } {
  // 如果已有自动分类，优先使用
  if (autoCategory) {
    // 尝试匹配已知类别
    for (const rule of CATEGORY_RULES) {
      if (rule.category === autoCategory) {
        return { category: autoCategory, subCategory: rule.subCategory || '' };
      }
    }
    return { category: autoCategory, subCategory: '' };
  }

  const lowerCmd = commandName.toLowerCase();
  const lowerCn = (chineseName || '').toLowerCase();
  const lowerTags = (tags || []).map(t => t.toLowerCase());

  // 关键词匹配
  for (const rule of CATEGORY_RULES) {
    const matches = rule.keywords.some(k =>
      lowerCmd.includes(k) ||
      lowerCn.includes(k) ||
      lowerTags.some(t => t.includes(k)),
    );
    if (matches) return { category: rule.category, subCategory: rule.subCategory };
  }

  // 中文关键词
  for (const rule of CHINESE_KEYWORD_MAP) {
    const matches = rule.keywords.some(k =>
      lowerCmd.includes(k) ||
      lowerCn.includes(k) ||
      lowerTags.some(t => t.includes(k)),
    );
    if (matches) return { category: rule.category, subCategory: rule.subCategory };
  }

  return { category: '未分类工具', subCategory: '' };
}

/**
 * 从 CommandIndex 数据生成推荐菜单
 */
export function generateRecommendedMenu(
  commands: RecommendMenuInput[],
  options: {
    skipLoaded?: boolean;
    skipHasMenu?: boolean;
    skipCompanySkill?: boolean;
    byCategory?: boolean;
  } = {},
): MenuItemConfig[] {
  const now = new Date().toISOString();
  const {
    skipLoaded = true,
    skipHasMenu = true,
    skipCompanySkill = true,
    byCategory = true,
  } = options;

  // 过滤
  const filtered = commands.filter(cmd => {
    if (skipLoaded && !cmd.skillLoaded) return false;
    if (skipHasMenu && cmd.menuPaths && cmd.menuPaths.length > 0) return false;
    if (skipCompanySkill && cmd.sourceType === 'company_skill') return false;
    return true;
  });

  if (filtered.length === 0) {
    return [];
  }

  // 按分类分组
  const categoryMap = new Map<string, RecommendMenuInput[]>();
  for (const cmd of filtered) {
    const { category } = classifyCommand(
      cmd.commandName,
      cmd.chineseName,
      cmd.autoCategory,
      cmd.tags,
    );
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(cmd);
  }

  // 生成菜单树
  const topMenu: MenuItemConfig = {
    id: `menu_rec_${Date.now()}`,
    label: 'ATM Tools',
    type: 'menu',
    path: ['ATM Tools'],
    order: 0,
    menuSource: 'atm_managed',
    enabled: true,
    visible: true,
    children: [],
    status: 'normal',
    createdAt: now,
    updatedAt: now,
  };

  let order = 0;
  for (const [category, cmds] of categoryMap) {
    if (byCategory) {
      const subMenu: MenuItemConfig = {
        id: `menu_rec_cat_${order}_${Date.now()}`,
        label: category,
        type: 'menu',
        path: ['ATM Tools', category],
        order,
        menuSource: 'atm_managed',
        enabled: true,
        visible: true,
        children: [],
        status: 'normal',
        createdAt: now,
        updatedAt: now,
      };
      for (let ci = 0; ci < cmds.length; ci++) {
        const cmd = cmds[ci];
        subMenu.children!.push({
          id: `menu_rec_cmd_${order}_${ci}_${Date.now()}`,
          label: cmd.chineseName || cmd.commandName,
          type: 'command',
          path: ['ATM Tools', category, cmd.chineseName || cmd.commandName],
          order: ci,
          command: cmd.commandName,
          commandSource: (cmd.sourceType === 'allegro_builtin' ? 'allegro_builtin'
            : cmd.sourceType === 'company_skill' ? 'company_skill'
            : 'atm_managed_skill') as any,
          sourceSkillId: cmd.sourceSkillId,
          sourceSkillName: cmd.sourceSkillName,
          sourceSkillFile: cmd.sourceSkillFile,
          hotkeys: cmd.hotkeys,
          menuSource: 'atm_managed',
          enabled: true,
          visible: true,
          status: 'normal',
          createdAt: now,
          updatedAt: now,
        });
      }
      topMenu.children!.push(subMenu);
    } else {
      for (let ci = 0; ci < cmds.length; ci++) {
        const cmd = cmds[ci];
        topMenu.children!.push({
          id: `menu_rec_cmd_${order}_${ci}_${Date.now()}`,
          label: cmd.chineseName || cmd.commandName,
          type: 'command',
          path: ['ATM Tools', cmd.chineseName || cmd.commandName],
          order: ci,
          command: cmd.commandName,
          commandSource: (cmd.sourceType === 'allegro_builtin' ? 'allegro_builtin'
            : cmd.sourceType === 'company_skill' ? 'company_skill'
            : 'atm_managed_skill') as any,
          sourceSkillId: cmd.sourceSkillId,
          sourceSkillName: cmd.sourceSkillName,
          sourceSkillFile: cmd.sourceSkillFile,
          hotkeys: cmd.hotkeys,
          menuSource: 'atm_managed',
          enabled: true,
          visible: true,
          status: 'normal',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    order++;
  }

  return [topMenu];
}

// ═══════════════════════════════════════════════════
// 兼容旧接口
// ═══════════════════════════════════════════════════

/**
 * 加载旧格式菜单配置（兼容旧 IPC）
 * @deprecated 使用 loadMenuProfileStore 替代
 */
export function loadMenuProfile(profilePath: string): any {
  try {
    if (!fs.existsSync(profilePath)) {
      return { profileVersion: '1.0', updatedAt: new Date().toISOString(), menus: [] };
    }
    const raw = fs.readFileSync(profilePath, { encoding: 'utf-8' });
    return JSON.parse(raw);
  } catch {
    return { profileVersion: '1.0', updatedAt: new Date().toISOString(), menus: [] };
  }
}

/**
 * 保存旧格式菜单配置（兼容旧 IPC）
 * @deprecated 使用 saveMenuProfileStore 替代
 */
export function saveMenuProfile(profilePath: string, profile: any): boolean {
  try {
    const dir = path.dirname(profilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    profile.updatedAt = new Date().toISOString();
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}
