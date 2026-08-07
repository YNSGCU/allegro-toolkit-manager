/**
 * ATM - Skill Profile 类型定义（V5.5）
 */
import type { ProfileCompatibilityMetadata } from './environment';
export interface SkillProfileItem {
  skillId: string;
  skillName: string;
  sourceFile: string;
  enabled: boolean;
  loadEnabled: boolean;
  order: number;
  note?: string;
}

export interface SkillProfile {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  skillStates: SkillProfileItem[];
  loadOrder: string[];
  createdAt: string;
  updatedAt: string;
  sourceEnvironmentId?: string | null;
  sourceAllegroVersion?: string | null;
  testedAllegroVersions?: string[];
  targetCompatibility?: ProfileCompatibilityMetadata;
}

export interface SkillProfileStore {
  version: string;
  activeProfileId: string;
  profiles: SkillProfile[];
  updatedAt: string;
}

export interface SkillProfileDiff {
  willEnable: string[];
  willDisable: string[];
  loadOrderChanges: Array<{ skillId: string; from: number; to: number }>;
  hotkeyRefs: Array<{ skillId: string; skillName?: string; command: string; hotkey?: string }>;
  menuRefs: Array<{ skillId: string; skillName?: string; command: string; menuPath?: string }>;
  risks: Array<{ severity: 'info' | 'warning' | 'error'; title: string; description: string }>;
}

export function generateSkillProfileId(): string {
  return `skill_profile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultSkillProfile(): SkillProfile {
  const now = new Date().toISOString();
  return {
    id: 'default',
    name: '默认 Skill 方案',
    description: '当前所有已启用 Skill 的状态快照',
    enabled: true,
    skillStates: [],
    loadOrder: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptySkillProfileStore(): SkillProfileStore {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    activeProfileId: 'default',
    profiles: [createDefaultSkillProfile()],
    updatedAt: now,
  };
}
