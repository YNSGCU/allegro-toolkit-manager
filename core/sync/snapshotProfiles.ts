/**
 * ATM - 当前环境实时快照（V6.4）
 *
 * 当源环境还没有保存快捷键 / Skill 方案（空方案）时，从 env 文件真实 funckey/alias
 * 与 Skill 扫描结果构建「实时快照」参与同步，让同步开箱可用；
 * 快照不落盘，同步产物仍是目标环境的正式新方案。
 */
import fs from 'fs';
import path from 'path';
import { parseEnv } from '../parser/parseEnv';
import { buildSkillProfileFromScan } from '../skill/skillProfileManager';
import type { HotkeyProfile, HotkeyProfileBinding } from '../../src/types/hotkey';
import type { SkillProfile } from '../../src/types/skillProfile';

export interface SnapshotSkillSource {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  loadStatus: string;
}

export interface EnvironmentSnapshotInput {
  pcbenvPath: string;
  envFilePath?: string;
  scannedSkills: SnapshotSkillSource[];
  /** 快照显示名（如「17.4 实时快照」） */
  label: string;
}

export interface EnvironmentSnapshotProfiles {
  hotkey?: HotkeyProfile;
  skill?: SkillProfile;
}

function buildHotkeySnapshot(envFilePath: string | undefined, label: string): HotkeyProfile | undefined {
  if (!envFilePath || !fs.existsSync(envFilePath)) return undefined;
  try {
    const result = parseEnv(fs.readFileSync(envFilePath, 'utf-8'));
    const bindings: HotkeyProfileBinding[] = (result.entries ?? [])
      .filter((entry) => entry.type === 'funckey' || entry.type === 'alias')
      .map((entry, index) => ({
        id: `snapshot_hk_${index}`,
        key: entry.key ?? '',
        command: entry.command ?? '',
        type: entry.type as 'funckey' | 'alias',
        enabled: true,
      }));
    if (bindings.length === 0) return undefined;
    const now = new Date().toISOString();
    return {
      id: `snapshot_hk_${Date.now().toString(36)}`,
      name: `${label}快捷键`,
      description: `由 ${label} env 文件生成的实时快照（未保存为方案）`,
      createdAt: now,
      updatedAt: now,
      bindings,
    };
  } catch {
    return undefined;
  }
}

function buildSkillSnapshot(
  scannedSkills: SnapshotSkillSource[],
  label: string,
): SkillProfile | undefined {
  const skills = (scannedSkills ?? []).filter((skill) => Boolean(skill.id));
  if (skills.length === 0) return undefined;
  const skillStates = buildSkillProfileFromScan(
    skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      path: skill.path,
      enabled: true,
      loadStatus: skill.loadStatus || 'loaded',
    })),
    skills.map((skill) => skill.id),
  );
  const now = new Date().toISOString();
  return {
    id: `snapshot_sk_${Date.now().toString(36)}`,
    name: `${label}Skill`,
    description: `由 ${label} 环境扫描生成的实时快照（未保存为方案）`,
    enabled: true,
    skillStates,
    loadOrder: skills.map((skill) => skill.id),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 生成当前环境实时快照方案（env 绑定 + Skill 扫描）。只读、不落盘。
 */
export function buildEnvironmentSnapshotProfiles(
  input: EnvironmentSnapshotInput,
): EnvironmentSnapshotProfiles {
  return {
    hotkey: buildHotkeySnapshot(input.envFilePath, input.label),
    skill: buildSkillSnapshot(input.scannedSkills, input.label),
  };
}

/** 判断快捷键方案是否为空（无绑定） */
export function isEmptyHotkeyProfile(
  profile: Pick<HotkeyProfile, 'bindings'> | null | undefined,
): boolean {
  return !profile || (profile.bindings ?? []).length === 0;
}

/** 判断 Skill 方案是否为空（无 skillStates） */
export function isEmptySkillProfile(
  profile: Pick<SkillProfile, 'skillStates'> | null | undefined,
): boolean {
  return !profile || (profile.skillStates ?? []).length === 0;
}
