/**
 * ATM - AXL 函数 Symphony 支持表
 *
 * 数据来源：Cadence 17.2-2016 Symphony SKILL Development Guide
 * Appendix 3: AXL Function Support（doc/symSkill/appB.html）。
 *
 * 类别含义：
 *   R = ReadOnly（只读安全，不改数据库）
 *   S = Supported（支持数据库变更）
 *   I = Changes Ignored（变更被 Symphony 忽略）
 *   U = Unsupported（不支持，变更不会发送到服务器）
 *   B = Obsolete（已废弃）
 */
import type { MuFunctionCategory, MuFunctionSupportEntry } from '../../src/types/symphony';
import muFunctionTableData from './data/muFunctionTable.json';

interface MuTableData {
  description: string;
  version: string;
  functions: Record<string, MuFunctionSupportEntry>;
}

/** 内置支持表（加载时归一化 key 为小写，查询统一用小写） */
const muTable: MuTableData = {
  description: muFunctionTableData.description,
  version: muFunctionTableData.version,
  functions: Object.fromEntries(
    Object.entries(muFunctionTableData.functions).map(([name, entry]) => [
      name.toLowerCase(),
      entry as MuFunctionSupportEntry,
    ]),
  ),
};

/**
 * 查询 AXL 函数在 Symphony 环境下的支持类别。
 * @param functionName 函数名（如 "axlDBDeleteObject"），大小写不敏感
 * @returns 支持条目；未收录的函数返回 { category: 'unknown', obsolete: false }
 */
export function getMuFunctionSupport(functionName: string): MuFunctionSupportEntry {
  const key = functionName.trim().toLowerCase();
  if (!key) return { category: 'unknown', obsolete: false };
  const entry = muTable.functions[key];
  if (!entry) return { category: 'unknown', obsolete: false };
  return { category: entry.category, obsolete: entry.obsolete };
}

/** 是否为 U（Unsupported）类函数：不支持数据库变更发送 */
export function isMuUnsupported(functionName: string): boolean {
  return getMuFunctionSupport(functionName).category === 'U';
}

/** 是否为只读安全（R）类函数 */
export function isMuReadOnly(functionName: string): boolean {
  return getMuFunctionSupport(functionName).category === 'R';
}

/** 是否允许数据库变更（S 类） */
export function isMuWriteSupported(functionName: string): boolean {
  return getMuFunctionSupport(functionName).category === 'S';
}

/** 类别中文标签 */
export const MU_CATEGORY_LABELS: Record<MuFunctionCategory, string> = {
  R: '只读安全',
  S: '支持变更',
  I: '变更被忽略',
  U: '不支持',
  B: '已废弃',
  unknown: '未收录（需人工确认）',
};

/** 类别严重级别（用于 UI 颜色） */
export const MU_CATEGORY_SEVERITY: Record<MuFunctionCategory, 'safe' | 'warning' | 'danger'> = {
  R: 'safe',
  S: 'safe',
  I: 'warning',
  U: 'danger',
  B: 'warning',
  unknown: 'warning',
};

/** 表内函数总数（用于 UI 展示） */
export function getMuTableSize(): number {
  return Object.keys(muTable.functions).length;
}

/** 表版本与来源描述 */
export function getMuTableInfo(): { version: string; description: string; size: number } {
  return {
    version: muTable.version,
    description: muTable.description,
    size: Object.keys(muTable.functions).length,
  };
}
