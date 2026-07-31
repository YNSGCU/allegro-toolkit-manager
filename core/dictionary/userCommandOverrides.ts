/**
 * ATM - 用户命令来源修正系统
 *
 * 用户可以对某条命令的来源进行手动修正。
 * 修正结果保存到 user_command_overrides.json，
 * 后续扫描优先使用用户修正结果。
 */
import fs from 'fs';
import path from 'path';
import type { CommandSource } from '../dictionary/commandDictionary';

/** 用户修正记录 */
export interface UserCommandOverride {
  /** 命令名（小写归一化） */
  commandName: string;
  /** 用户指定的来源类型 */
  source: CommandSource | 'ambiguous';
  /** 可信度 */
  confidence: 'high' | 'medium' | 'low';
  /** 备注 */
  note?: string;
  /** 用户指定的 Skill 名称（可选） */
  skillName?: string;
  /** 修正时间 */
  updatedAt: string;
}

export interface UserCommandOverrideData {
  version: string;
  overrides: Record<string, UserCommandOverride>;
}

/** 默认覆盖文件路径（相对于 pcbenv/atm_generated/） */
const DEFAULT_OVERRIDE_FILENAME = 'user_command_overrides.json';

/**
 * 获取覆盖文件路径
 */
export function getOverrideFilePath(pcbenvPath: string): string {
  return path.join(pcbenvPath, 'atm_generated', DEFAULT_OVERRIDE_FILENAME);
}

/**
 * 加载用户命令来源修正记录
 */
export function loadUserOverrides(overrideFilePath?: string): Record<string, UserCommandOverride> {
  if (!overrideFilePath) return {};
  try {
    if (!fs.existsSync(overrideFilePath)) return {};
    const raw = fs.readFileSync(overrideFilePath, 'utf-8');
    const data: UserCommandOverrideData = JSON.parse(raw);
    return data.overrides || {};
  } catch {
    return {};
  }
}

/**
 * 保存用户命令来源修正记录
 */
export function saveUserOverrides(
  overrideFilePath: string,
  overrides: Record<string, UserCommandOverride>,
): boolean {
  try {
    const dir = path.dirname(overrideFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data: UserCommandOverrideData = {
      version: '1.0',
      overrides,
    };
    fs.writeFileSync(overrideFilePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 添加/更新一条命令来源修正
 */
export function setCommandOverride(
  overrides: Record<string, UserCommandOverride>,
  commandName: string,
  source: UserCommandOverride['source'],
  confidence: UserCommandOverride['confidence'],
  note?: string,
  skillName?: string,
): Record<string, UserCommandOverride> {
  const key = commandName.toLowerCase().trim();
  overrides[key] = {
    commandName: key,
    source,
    confidence,
    note,
    skillName,
    updatedAt: new Date().toISOString(),
  };
  return { ...overrides };
}

/**
 * 删除一条命令来源修正
 */
export function removeCommandOverride(
  overrides: Record<string, UserCommandOverride>,
  commandName: string,
): Record<string, UserCommandOverride> {
  const key = commandName.toLowerCase().trim();
  const result = { ...overrides };
  delete result[key];
  return result;
}

/**
 * 根据用户修正记录判断命令来源
 * @returns 如果找到修正记录，返回修正后的来源；否则返回 null
 */
export function lookupOverride(
  overrides: Record<string, UserCommandOverride>,
  commandName: string,
): UserCommandOverride | null {
  const key = commandName.toLowerCase().trim();
  return overrides[key] || null;
}
