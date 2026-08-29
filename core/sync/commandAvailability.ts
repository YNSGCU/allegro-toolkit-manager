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
import fs from 'fs';
import path from 'path';

export interface ScannedSkillCommands {
  skillId: string;
  name: string;
  commands: string[];
  /** axlCmdRegister 注册命令（增强解析），同样作为该 Skill 提供的命令 */
  registeredCommands?: string[];
}

/** 基础命令：分号（多命令串）视为分隔符，取第一个词 */
export function baseCommandOf(raw: string): string {
  return extractBaseCommand(raw.replace(/;/g, ' '));
}

/** 整串归一化：去引号/分号/多余空白，用于 1 词与 2 词前缀的内置判定 */
export function normalizeWholeCommand(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/["';]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 默认已知命令集 = 内置命令表 ∪ 命令字典（command_dictionary.json 的键）。
 * 字典包含用户环境长期采集的命令（如 cvn / snp），用于提升识别精度。
 */
export function loadKnownCommandSet(): Set<string> {
  const result = new Set<string>();
  try {
    const candidates = [
      // 源码位置（vitest / ts-node）：core/sync/../dictionary
      path.join(__dirname, '..', 'dictionary', 'command_dictionary.json'),
      // 编译产物位置（dist-electron/core/sync/../../../core/dictionary）
      path.join(__dirname, '..', '..', '..', 'core', 'dictionary', 'command_dictionary.json'),
    ];
    const dictionaryPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!dictionaryPath) return result;
    const raw = JSON.parse(fs.readFileSync(dictionaryPath, 'utf-8')) as {
      commands?: Record<string, unknown>;
    };
    if (raw.commands && typeof raw.commands === 'object') {
      for (const commandName of Object.keys(raw.commands)) {
        const norm = normalizeWholeCommand(commandName);
        if (!norm) continue;
        result.add(norm);
        const words = norm.split(' ');
        if (words[0]) result.add(words[0]);
        if (words[1]) result.add(`${words[0]} ${words[1]}`);
      }
    }
  } catch {
    // 字典不可读时回退到内置命令表
  }
  return result;
}

/** 合并内置命令表与字典，作为 buildCommandAvailability 的默认已知命令集 */
export function defaultKnownCommands(): Set<string> {
  return new Set([...ALLEGRO_BUILTIN_COMMANDS, ...loadKnownCommandSet()]);
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
  builtinCommands: ReadonlySet<string> = defaultKnownCommands(),
): Map<string, CommandAvailabilityProvider[]> {
  const index = new Map<string, CommandAvailabilityProvider[]>();

  for (const builtin of builtinCommands) {
    const norm = normalizeWholeCommand(builtin);
    if (!norm) continue;
    const words = norm.split(' ');
    const keys = new Set<string>([norm]);
    if (words[1]) keys.add(`${words[0]} ${words[1]}`);
    for (const key of keys) {
      const list = index.get(key) ?? [];
      if (!list.some((provider) => provider.scope === 'builtin')) list.push({ scope: 'builtin' });
      index.set(key, list);
    }
  }

  for (const skill of scannedSkills ?? []) {
    // Skill 文件名主干（snp.il → snp）也是常用命令入口约定
    const stem = (skill.name ?? '').replace(/\.il$/i, '');
    const commandNames = [
      ...(skill.commands ?? []),
      ...(skill.registeredCommands ?? []),
      stem,
    ].filter((command) => Boolean(command?.trim()));
    for (const raw of commandNames) {
      const base = baseCommandOf(raw);
      if (!base) continue;
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
  const norm = normalizeWholeCommand(command);
  if (!norm) return { available: false, providers: [] };
  const words = norm.split(' ');
  const candidates = new Set<string>([norm, baseCommandOf(command)]);
  if (words[1]) candidates.add(`${words[0]} ${words[1]}`);
  for (const key of candidates) {
    const providers = index.get(key) ?? [];
    if (providers.length > 0) return { available: true, providers };
  }
  return { available: false, providers: [] };
}
