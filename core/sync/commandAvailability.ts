/**
 * ATM - 目标环境命令可用性构建（V6.4）
 *
 * 给定目标环境的全部 Skill（入口命令/函数）与内置命令表，构建
 * 「归一化命令 → 提供者列表」索引，供跨版本同步分类复用。
 * 纯函数、可测试；逻辑与 workspaceReferenceCheck 一致，提取为公共能力。
 */
import { ALLEGRO_BUILTIN_COMMANDS } from '../validator/commandClassifier';
import { extractBaseCommand } from '../skill/commandIndex';
import type { CommandAvailabilityProvider } from '../../src/types/sync';

export interface ScannedSkillCommands {
  skillId: string;
  name: string;
  commands: string[];
}

/**
 * 构建命令提供者索引：
 *  - 内置命令表全部命令 → scope 'builtin'
 *  - 扫描到的 Skill 入口命令/函数 → scope 'skill'（保留 skillId/name）
 *
 * key 为归一化基础命令（extractBaseCommand 的结果）。
 */
export function buildCommandAvailability(
  scannedSkills: ScannedSkillCommands[],
  builtinCommands: ReadonlySet<string> = ALLEGRO_BUILTIN_COMMANDS,
): Map<string, CommandAvailabilityProvider[]> {
  const index = new Map<string, CommandAvailabilityProvider[]>();

  for (const builtin of builtinCommands) {
    const key = builtin.trim().toLowerCase();
    if (key) index.set(key, [{ scope: 'builtin' }]);
  }

  for (const skill of scannedSkills ?? []) {
    for (const raw of skill.commands ?? []) {
      const base = extractBaseCommand(raw);
      if (!base || index.get(base)?.some((provider) => provider.scope === 'builtin')) continue;
      const list = index.get(base) ?? [];
      if (!list.some((provider) => provider.scope === 'skill' && provider.skillId === skill.skillId)) {
        list.push({ scope: 'skill', skillId: skill.skillId, skillName: skill.name });
      }
      index.set(base, list);
    }
  }
  return index;
}

/** 查询命令是否可用及其提供者 */
export function queryCommandAvailability(
  index: Map<string, CommandAvailabilityProvider[]>,
  command: string,
): { available: boolean; providers: CommandAvailabilityProvider[] } {
  const base = extractBaseCommand(command);
  if (!base) return { available: false, providers: [] };
  const providers = index.get(base) ?? [];
  return { available: providers.length > 0, providers };
}
