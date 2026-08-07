/**
 * ATM - 快捷键方案 Profile 管理
 *
 * 方案只管理 ATM 托管快捷键，不强制接管用户原始 env 快捷键。
 * 支持：新建/复制/重命名/删除/导入/导出/切换/差异比较
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { HotkeyProfile, HotkeyProfileBinding, ProfileDiff } from '../../src/types/hotkey';

/** Profile 存储目录（相对于 pcbenv/atm_generated/profiles/） */
const PROFILES_DIR_NAME = 'profiles';

/** Profile 文件扩展名 */
const PROFILE_EXT = '.profile.json';

/** 默认方案名 */
const DEFAULT_PROFILE_NAME = '默认方案';

// ── 路径辅助 ──

/** 获取 profiles 目录路径 */
export function getProfilesDir(pcbenvPath: string): string {
  return path.join(pcbenvPath, 'atm_generated', PROFILES_DIR_NAME);
}

/** 获取单个 Profile 文件路径 */
export function getProfileFilePath(profilesDir: string, profileId: string): string {
  return path.join(profilesDir, `${profileId}${PROFILE_EXT}`);
}

/** 生成唯一 ID */
function generateId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'profile-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ── CRUD ──

/** 加载所有 Profile */
export function loadAllProfiles(pcbenvPath: string): HotkeyProfile[] {
  const profilesDir = getProfilesDir(pcbenvPath);
  if (!fs.existsSync(profilesDir)) return [];

  try {
    const files = fs.readdirSync(profilesDir).filter((f) => f.endsWith(PROFILE_EXT));
    const profiles: HotkeyProfile[] = [];

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(profilesDir, file), 'utf-8');
        const profile: HotkeyProfile = JSON.parse(raw);
        profiles.push(profile);
      } catch {
        // 跳过损坏的文件
      }
    }

    return profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

/** 加载单个 Profile */
export function loadProfile(pcbenvPath: string, profileId: string): HotkeyProfile | null {
  const profilesDir = getProfilesDir(pcbenvPath);
  const filePath = getProfileFilePath(profilesDir, profileId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 保存 Profile */
export function saveProfile(pcbenvPath: string, profile: HotkeyProfile): boolean {
  try {
    const profilesDir = getProfilesDir(pcbenvPath);
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    const filePath = getProfileFilePath(profilesDir, profile.id);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/** 删除 Profile（不允许删除默认方案） */
export function deleteProfile(pcbenvPath: string, profileId: string): boolean {
  const profile = loadProfile(pcbenvPath, profileId);
  if (!profile || profile.name === DEFAULT_PROFILE_NAME) return false;

  try {
    const profilesDir = getProfilesDir(pcbenvPath);
    const filePath = getProfileFilePath(profilesDir, profileId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch {
    return false;
  }
}

/** 创建新方案 */
export function createProfile(
  pcbenvPath: string,
  name: string,
  description?: string,
  sourceBindings?: HotkeyProfileBinding[],
  metadata?: Pick<HotkeyProfile, 'sourceEnvironmentId' | 'sourceAllegroVersion' | 'testedAllegroVersions' | 'targetCompatibility'>,
): HotkeyProfile | null {
  const now = new Date().toISOString();
  const profile: HotkeyProfile = {
    id: generateId(),
    name,
    description: description || '',
    createdAt: now,
    updatedAt: now,
    bindings: sourceBindings || [],
    ...metadata,
  };

  return saveProfile(pcbenvPath, profile) ? profile : null;
}

/** 复制方案（生成新 ID 和名称） */
export function copyProfile(
  pcbenvPath: string,
  sourceProfileId: string,
  newName?: string,
): HotkeyProfile | null {
  const source = loadProfile(pcbenvPath, sourceProfileId);
  if (!source) return null;

  const now = new Date().toISOString();
  const copy: HotkeyProfile = {
    id: generateId(),
    name: newName || `${source.name} (副本)`,
    description: source.description,
    createdAt: now,
    updatedAt: now,
    bindings: JSON.parse(JSON.stringify(source.bindings)), // 深拷贝
  };

  return saveProfile(pcbenvPath, copy) ? copy : null;
}

/** 重命名方案 */
export function renameProfile(pcbenvPath: string, profileId: string, newName: string): boolean {
  const profile = loadProfile(pcbenvPath, profileId);
  if (!profile) return false;

  profile.name = newName;
  profile.updatedAt = new Date().toISOString();
  return saveProfile(pcbenvPath, profile);
}

/** 导出方案为 JSON 字符串 */
export function exportProfileToJson(pcbenvPath: string, profileId: string): string | null {
  const profile = loadProfile(pcbenvPath, profileId);
  if (!profile) return null;
  return JSON.stringify(profile, null, 2);
}

/** 从 JSON 字符串导入方案 */
export function importProfileFromJson(
  pcbenvPath: string,
  jsonStr: string,
  newId?: boolean,
): HotkeyProfile | null {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.bindings || !Array.isArray(data.bindings)) return null;

    if (newId !== false) {
      data.id = generateId();
    }
    data.createdAt = new Date().toISOString();
    data.updatedAt = data.createdAt;

    if (!data.name) data.name = `导入方案 ${new Date().toLocaleDateString()}`;
    if (!data.description) data.description = '';
    if (!Array.isArray(data.testedAllegroVersions)) data.testedAllegroVersions = [];

    return saveProfile(pcbenvPath, data as HotkeyProfile) ? (data as HotkeyProfile) : null;
  } catch {
    return null;
  }
}

// ── 差异比较 ──

/** 比较两个方案之间的差异 */
export function diffProfiles(
  source: HotkeyProfile,
  target: HotkeyProfile,
): ProfileDiff {
  const sourceMap = new Map(source.bindings.map((b) => [b.id, b]));
  const targetMap = new Map(target.bindings.map((b) => [b.id, b]));

  const added: HotkeyProfileBinding[] = [];
  const removed: HotkeyProfileBinding[] = [];
  const modified: { before: HotkeyProfileBinding; after: HotkeyProfileBinding }[] = [];

  // 在 target 但不在 source → added
  for (const tb of target.bindings) {
    if (!sourceMap.has(tb.id)) {
      added.push(tb);
    }
  }

  // 在 source 但不在 target → removed
  // 在 source 且在 target 但不同 → modified
  for (const sb of source.bindings) {
    const tb = targetMap.get(sb.id);
    if (!tb) {
      removed.push(sb);
    } else if (
      sb.key !== tb.key ||
      sb.command !== tb.command ||
      sb.type !== tb.type ||
      sb.enabled !== tb.enabled
    ) {
      modified.push({ before: sb, after: tb });
    }
  }

  return {
    sourceProfileId: source.id,
    targetProfileId: target.id,
    added,
    removed,
    modified,
  };
}

/** 比较当前 Profile 和 env 方案 → 生成 Apply Plan 操作 */
export function generateProfileSyncPlan(
  profile: HotkeyProfile,
  envContent: string,
  pcbenvPath: string,
): { summary: string; steps: { type: string; target: string; description: string }[] } {
  const steps: { type: string; target: string; description: string }[] = [];

  // 步骤 1: 备份 env
  steps.push({
    type: 'backup',
    target: path.join(pcbenvPath, 'env'),
    description: '备份当前 env 文件',
  });

  // 步骤 2: 生成托管块内容
  const profileBlock = generateProfileEnvBlock(profile);

  steps.push({
    type: 'modify_managed_block',
    target: path.join(pcbenvPath, 'env'),
    description: `应用方案 "${profile.name}" 的快捷键配置（${profile.bindings.filter((b) => b.enabled).length} 个快捷键）`,
  });

  return {
    summary: `切换方案到 "${profile.name}"`,
    steps,
  };
}

/** 生成 Profile 对应的托管块内容 */
export function generateProfileEnvBlock(profile: HotkeyProfile): string {
  const enabled = profile.bindings.filter((b) => b.enabled);
  if (enabled.length === 0) return '';

  return enabled
    .map((b) => {
      const cmd = b.command.includes(' ') ? `"${b.command}"` : b.command;
      return `${b.type} ${b.key} ${cmd}`;
    })
    .join('\n');
}

/** 将 binding 转换为 ProfileBinding */
export function bindingToProfileBinding(b: {
  id: string;
  key: string;
  command: string;
  type: 'funckey' | 'alias';
  chineseName?: string;
  commandSource?: string;
  enabled?: boolean;
  notes?: string[];
}): HotkeyProfileBinding {
  return {
    id: b.id,
    key: b.key,
    command: b.command,
    type: b.type,
    chineseName: b.chineseName,
    commandSource: b.commandSource as HotkeyProfileBinding['commandSource'],
    enabled: b.enabled !== false,
    note: b.notes?.[0],
  };
}

/** 获取默认方案（不存在时创建） */
export function getOrCreateDefaultProfile(pcbenvPath: string): HotkeyProfile {
  const profiles = loadAllProfiles(pcbenvPath);
  const defaultProfile = profiles.find((p) => p.name === DEFAULT_PROFILE_NAME);
  if (defaultProfile) return defaultProfile;

  const created = createProfile(pcbenvPath, DEFAULT_PROFILE_NAME, 'ATM 默认快捷键方案');
  return created || {
    id: 'default',
    name: DEFAULT_PROFILE_NAME,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bindings: [],
  };
}
