/**
 * ATM - 命令字典模块
 *
 * 管理 Allegro 命令的中文名称、分类和说明。
 * 支持:
 *   1. 内置字典 (command_dictionary.json) — 预置常见 Allegro 命令
 *   2. 用户自定义字典 (user_command_dictionary.json) — 用户扩展
 */
import fs from 'fs';
import path from 'path';

/** 命令来源类型 */
export type CommandSource =
  | 'allegro_builtin'
  | 'user_skill'
  | 'company_skill'
  | 'atm_managed_skill'
  | 'unknown';

/** 字典条目 */
export interface DictionaryEntry {
  chineseName: string;
  category: string;
  description: string;
  defaultSource: CommandSource;
}

/** 字典查询结果 */
export interface DictionaryLookupResult {
  found: boolean;
  entry?: DictionaryEntry;
  /** 匹配方式: exact / partial */
  matchType: 'exact' | 'partial';
}

/** 命令字典 */
export interface CommandDictionaryData {
  description: string;
  version: string;
  commands: Record<string, DictionaryEntry>;
}

/** 命令分类信息（含中文名、来源、Skill 信息等） */
export interface CommandClassification {
  commandName: string;
  chineseName: string;
  category: string;
  description: string;
  source: CommandSource;
  skillName: string | null;
  skillFilePath: string | null;
  skillTier: string | null;
  confidence: 'high' | 'medium' | 'low';
  loadStatus: 'loaded_configured' | 'maybe_unloaded' | 'unknown';
}

/** 加载内置命令字典 */
export function loadBuiltinDictionary(): Record<string, DictionaryEntry> {
  const dictPath = path.join(__dirname, 'command_dictionary.json');
  try {
    const raw = fs.readFileSync(dictPath, 'utf-8');
    const data: CommandDictionaryData = JSON.parse(raw);
    return data.commands || {};
  } catch {
    // 在生产环境中尝试相对路径（开发时 __dirname 在 dist 下）
    try {
      const altPath = path.join(__dirname, '..', 'dictionary', 'command_dictionary.json');
      const raw = fs.readFileSync(altPath, 'utf-8');
      const data: CommandDictionaryData = JSON.parse(raw);
      return data.commands || {};
    } catch {
      return {};
    }
  }
}

/** 加载用户自定义字典 */
export function loadUserDictionary(dictPath?: string): Record<string, DictionaryEntry> {
  if (!dictPath) return {};
  try {
    if (!fs.existsSync(dictPath)) return {};
    const raw = fs.readFileSync(dictPath, 'utf-8');
    const data: CommandDictionaryData = JSON.parse(raw);
    return data.commands || {};
  } catch {
    return {};
  }
}

/** 合并字典（用户字典优先覆盖） */
export function mergeDictionaries(
  builtin: Record<string, DictionaryEntry>,
  user: Record<string, DictionaryEntry>,
): Record<string, DictionaryEntry> {
  return { ...builtin, ...user };
}

/** 在字典中查找命令 */
export function lookupInDictionary(
  dictionaries: Record<string, DictionaryEntry>[],
  commandName: string,
): DictionaryLookupResult {
  const lowerName = commandName.toLowerCase().trim();

  for (const dict of dictionaries) {
    // 1. 精确匹配
    if (dict[lowerName]) {
      return { found: true, entry: dict[lowerName], matchType: 'exact' };
    }

    // 2. 部分匹配（命令可能是多词组合）
    // 比如 "add connect" 精确匹配，但有时命令只是 "add"，"slide" 等
    // 检查是否有命令以该名称开头
    for (const [key, entry] of Object.entries(dict)) {
      if (key.startsWith(lowerName + ' ') || key === lowerName) {
        return { found: true, entry, matchType: 'exact' };
      }
    }
  }

  return { found: false, matchType: 'partial' };
}

/** 获取命令的显示名称（中文优先，无则返回原始命令） */
export function getDisplayName(
  commandName: string,
  dictionaries: Record<string, DictionaryEntry>[],
): string {
  const result = lookupInDictionary(dictionaries, commandName);
  if (result.found && result.entry) {
    return result.entry.chineseName;
  }
  return commandName;
}

/** 创建默认字典实例（内置 + 可选用户自定义） */
export function createDictionary(userDictPath?: string): {
  builtin: Record<string, DictionaryEntry>;
  user: Record<string, DictionaryEntry>;
  merged: Record<string, DictionaryEntry>;
} {
  const builtin = loadBuiltinDictionary();
  const user = loadUserDictionary(userDictPath);
  const merged = mergeDictionaries(builtin, user);
  return { builtin, user, merged };
}
