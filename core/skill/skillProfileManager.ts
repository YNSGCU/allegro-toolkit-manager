/**
 * ATM - Skill Profile 管理模块（V5.5）
 *
 * Skill Profile 管理 Skill 启用/禁用状态、加载顺序。
 * 写入路径：pcbenv/atm_generated/skill_profiles.json
 */
import fs from 'fs';
import path from 'path';
import type {
  SkillProfile,
  SkillProfileStore,
  SkillProfileItem,
  SkillProfileDiff,
} from '../../src/types/skillProfile';
import { createDefaultSkillProfile, createEmptySkillProfileStore, generateSkillProfileId } from '../../src/types/skillProfile';
import { ATM_SKILL_LOADER_END, ATM_SKILL_LOADER_START } from '../../src/types/skill';

// ═══════════════════════════════════════════════════
// 数据管理
// ═══════════════════════════════════════════════════

export function getSkillProfilePath(atmGeneratedPath: string): string {
  return path.join(atmGeneratedPath, 'skill_profiles.json');
}

export function loadSkillProfileStore(atmGeneratedPath: string): SkillProfileStore {
  const profilePath = getSkillProfilePath(atmGeneratedPath);
  try {
    if (!fs.existsSync(profilePath)) {
      return createEmptySkillProfileStore();
    }
    const raw = fs.readFileSync(profilePath, { encoding: 'utf-8' });
    const parsed = JSON.parse(raw);
    if (parsed.version && Array.isArray(parsed.profiles)) {
      return parsed as SkillProfileStore;
    }
    return createEmptySkillProfileStore();
  } catch {
    return createEmptySkillProfileStore();
  }
}

export function saveSkillProfileStore(atmGeneratedPath: string, store: SkillProfileStore): boolean {
  try {
    const profilePath = getSkillProfilePath(atmGeneratedPath);
    if (!fs.existsSync(atmGeneratedPath)) {
      fs.mkdirSync(atmGeneratedPath, { recursive: true });
    }
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(profilePath, JSON.stringify(store, null, 2), { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

export function getActiveSkillProfile(store: SkillProfileStore): SkillProfile | null {
  return store.profiles.find(p => p.id === store.activeProfileId) || store.profiles[0] || null;
}

// ═══════════════════════════════════════════════════
// Profile CRUD
// ═══════════════════════════════════════════════════

export function listSkillProfiles(store: SkillProfileStore): SkillProfile[] {
  return store.profiles;
}

export function setActiveSkillProfile(store: SkillProfileStore, profileId: string): SkillProfileStore {
  if (store.profiles.some(p => p.id === profileId)) {
    store.activeProfileId = profileId;
  }
  return store;
}

export function createSkillProfile(store: SkillProfileStore, name: string, description?: string): SkillProfileStore {
  const now = new Date().toISOString();
  const newProfile: SkillProfile = {
    id: generateSkillProfileId(),
    name,
    description: description || '',
    enabled: true,
    skillStates: [],
    loadOrder: [],
    createdAt: now,
    updatedAt: now,
  };
  store.profiles.push(newProfile);
  return store;
}

export function copySkillProfile(store: SkillProfileStore, profileId: string, newName?: string): SkillProfileStore {
  const source = store.profiles.find(p => p.id === profileId);
  if (!source) return store;
  const now = new Date().toISOString();
  const copy: SkillProfile = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateSkillProfileId(),
    name: newName || `${source.name} (副本)`,
    createdAt: now,
    updatedAt: now,
  };
  store.profiles.push(copy);
  return store;
}

export function renameSkillProfile(store: SkillProfileStore, profileId: string, newName: string): SkillProfileStore {
  const profile = store.profiles.find(p => p.id === profileId);
  if (profile) {
    profile.name = newName;
    profile.updatedAt = new Date().toISOString();
  }
  return store;
}

export function deleteSkillProfile(store: SkillProfileStore, profileId: string): SkillProfileStore {
  if (store.profiles.length <= 1) return store;
  store.profiles = store.profiles.filter(p => p.id !== profileId);
  if (store.activeProfileId === profileId) {
    store.activeProfileId = store.profiles[0].id;
  }
  return store;
}

// ═══════════════════════════════════════════════════
// 构建 Profile（从当前扫描结果快照）
// ═══════════════════════════════════════════════════

/**
 * 从当前 Skill 扫描结果构建 Profile 的快照
 */
export function buildSkillProfileFromScan(
  skills: Array<{ id: string; name: string; path: string; enabled: boolean; loadStatus: string }>,
  loadOrder: string[],
): SkillProfileItem[] {
  return skills.map((s, idx) => ({
    skillId: s.id || s.name,
    skillName: s.name,
    sourceFile: s.path,
    enabled: s.enabled,
    loadEnabled: s.enabled && s.loadStatus !== 'disabled',
    order: idx,
  }));
}

// ═══════════════════════════════════════════════════
// 差异计算
// ═══════════════════════════════════════════════════

export function computeSkillProfileDiff(
  currentProfile: SkillProfile,
  targetProfile: SkillProfile,
  hotkeyRefs?: Array<{ skillId: string; command: string; hotkey: string }>,
  menuRefs?: Array<{ skillId: string; menuPath: string; command: string }>,
): SkillProfileDiff {
  const diff: SkillProfileDiff = {
    willEnable: [],
    willDisable: [],
    loadOrderChanges: [],
    hotkeyRefs: [],
    menuRefs: [],
    risks: [],
  };

  const currentMap = new Map(currentProfile.skillStates.map(s => [s.skillId, s]));
  const targetMap = new Map(targetProfile.skillStates.map(s => [s.skillId, s]));

  // 启用/禁用差异
  for (const [skillId, targetState] of targetMap) {
    const currentState = currentMap.get(skillId);
    if (!currentState) {
      if (targetState.enabled) diff.willEnable.push(skillId);
      continue;
    }
    if (currentState.enabled !== targetState.enabled) {
      if (targetState.enabled) diff.willEnable.push(skillId);
      else diff.willDisable.push(skillId);
    }
  }

  // 加载顺序差异
  targetProfile.loadOrder.forEach((skillId, idx) => {
    const currentIdx = currentProfile.loadOrder.indexOf(skillId);
    if (currentIdx !== idx) {
      diff.loadOrderChanges.push({ skillId, from: currentIdx, to: idx });
    }
  });

  // 快捷键引用检查
  if (hotkeyRefs) {
    for (const ref of hotkeyRefs) {
      if (diff.willDisable.includes(ref.skillId)) {
        diff.hotkeyRefs.push(ref);
      }
    }
  }

  // 菜单引用检查
  if (menuRefs) {
    for (const ref of menuRefs) {
      if (diff.willDisable.includes(ref.skillId)) {
        diff.menuRefs.push(ref);
      }
    }
  }

  // 风险提示
  if (diff.hotkeyRefs.length > 0) {
    diff.risks.push({
      severity: 'warning',
      title: '部分将禁用的 Skill 有快捷键引用',
      description: `${diff.hotkeyRefs.length} 个快捷键绑定指向即将禁用的 Skill，快捷功能将不可用`,
    });
  }
  if (diff.menuRefs.length > 0) {
    diff.risks.push({
      severity: 'warning',
      title: '部分将禁用的 Skill 有菜单引用',
      description: `${diff.menuRefs.length} 个菜单项指向即将禁用的 Skill，菜单功能将不可用`,
    });
  }

  return diff;
}

// ═══════════════════════════════════════════════════
// Apply Plan 步骤
// ═══════════════════════════════════════════════════

/** 根据方案快照生成确定性的 Skill Loader 内容。 */
export function generateSkillProfileLoader(profile: SkillProfile): string {
  const orderIndex = new Map(profile.loadOrder.map((skillId, index) => [skillId, index]));
  const enabledItems = profile.skillStates
    .filter(item => item.enabled && item.loadEnabled && item.sourceFile)
    .sort((a, b) => {
      const aIndex = orderIndex.get(a.skillId) ?? a.order ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderIndex.get(b.skillId) ?? b.order ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex || a.skillName.localeCompare(b.skillName);
    });

  return [
    ATM_SKILL_LOADER_START,
    '; Auto-generated by ATM Skill Profile - do not edit manually',
    `; Profile: ${profile.name}`,
    `; Generated: ${new Date().toISOString()}`,
    '',
    ...enabledItems.map(item => `load("${item.sourceFile.replace(/\\/g, '/')}")`),
    ...(enabledItems.length === 0 ? ['; (no enabled Skill entries)'] : []),
    '',
    '; Company skills remain read-only and are loaded by CDS_SITE/SKILL_PATH.',
    ATM_SKILL_LOADER_END,
    '',
  ].join('\n');
}

export function getSkillProfileApplyPlanSteps(
  profilePath: string,
  loaderIlPath: string,
  profile: SkillProfile,
  atmGeneratedPath: string,
): Array<{
  type: string;
  title: string;
  description: string;
  targetFile: string;
  after?: string;
}> {
  const steps: Array<{
    type: string;
    title: string;
    description: string;
    targetFile: string;
    after?: string;
  }> = [
    {
      type: 'backup_file',
      title: '备份 Skill 方案配置',
      description: `备份 skill_profiles.json`,
      targetFile: profilePath,
    },
    {
      type: 'update_json',
      title: '更新 Skill 方案配置文件',
      description: `保存 Skill 方案（${profile.skillStates.length} 个 Skill 状态）`,
      targetFile: profilePath,
      after: JSON.stringify(profile, null, 2),
    },
    {
      type: 'write_file',
      title: '更新 Skill 加载器',
      description: `重新生成 generated_skill_loader.il（${profile.skillStates.filter(s => s.loadEnabled).length} 个加载项）`,
      targetFile: loaderIlPath,
    },
  ];

  // 检查 bootstrap
  const bootstrapPath = path.join(atmGeneratedPath, 'bootstrap.il');
  if (fs.existsSync(bootstrapPath)) {
    const content = fs.readFileSync(bootstrapPath, { encoding: 'utf-8' });
    if (!content.includes('generated_skill_loader.il')) {
      steps.push({
        type: 'ensure_bootstrap' as const,
        title: '确保 ATM 启动脚本加载 Skill',
        description: `在 bootstrap.il 中添加 Skill 加载器引用`,
        targetFile: bootstrapPath,
      });
    }
  }

  return steps;
}
