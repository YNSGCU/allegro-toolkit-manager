/**
 * ATM - 默认/保留快捷键参考库加载器
 *
 * 从 data/default_reserved_keys.json 读取预定义的默认快捷键数据。
 * 这些数据来源于参考库（不是 env 文件解析结果），
 * 用于在「默认/保留键」和「全部叠加」视图中展示。
 *
 * 该文件路径在运行时解析，不依赖 TypeScript 编译时的 JSON import。
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HotkeyBinding, BindingSourceType, CommandSourceType } from '../../src/types/hotkey';

// ──────────── 数据条目类型 ────────────

/** JSON 中每条保留键数据的结构 */
export interface ReservedKeyDataEntry {
  id: string;
  type: 'reserved';
  rawKey: string;
  displayKey: string;
  physicalKey: string;
  modifiers: string[];
  zhName: string;
  command: string;
  bindingSource: 'allegro_default' | 'system_reserved';
  commandSource: 'allegro_builtin' | 'system';
  editable: false;
  warnWhenOverride: true;
  status: 'readonly';
}

/** loadDefaultReservedKeys 返回结果 */
export interface ReservedKeyLoadResult {
  success: boolean;
  data: ReservedKeyDataEntry[];
  error?: string;
}

// ──────────── 加载函数 ────────────

/**
 * 加载默认/保留键参考库。
 *
 * @param filePath - 可选：default_reserved_keys.json 的绝对路径。
 *   如果不传，从编译后的 JS 位置向上解析。
 * @returns {ReservedKeyLoadResult}
 */
export function loadDefaultReservedKeys(filePath?: string): ReservedKeyLoadResult {
  const resolvedPath = filePath || path.resolve(__dirname, '../../../data/default_reserved_keys.json');

  try {
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        data: [],
        error: `默认快捷键参考库文件不存在: ${resolvedPath}`,
      };
    }

    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    const entries: ReservedKeyDataEntry[] = JSON.parse(raw);

    // 基本校验：必须是数组
    if (!Array.isArray(entries)) {
      return {
        success: false,
        data: [],
        error: '默认快捷键参考库格式错误：期望数组',
      };
    }

    // 校验每个条目包含必要字段
    const validEntries = entries.filter((e, i) => {
      if (!e.rawKey || !e.zhName) {
        console.warn(`[ATM] 保留键数据第 ${i} 条缺少 rawKey 或 zhName，已跳过`);
        return false;
      }
      return true;
    });

    return { success: true, data: validEntries };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: `加载默认快捷键参考库失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ──────────── 数据类型转换 ────────────

/**
 * 将 ReservedKeyDataEntry 转为 HotkeyBinding（用于统一展示）。
 *
 * 映射规则：
 * - type：funckey 类型（默认快捷键按键独立触发，不是别名）
 * - bindingSource：按原始数据分类
 * - commandSource：allegro_builtin 或 system
 * - editable: false，只读
 * - status: 'reserved'
 */
export function reservedEntryToBinding(entry: ReservedKeyDataEntry): HotkeyBinding {
  const isAllegro = entry.bindingSource === 'allegro_default';

  return {
    id: entry.id,
    key: entry.rawKey,
    command: entry.command || '',
    type: 'funckey',
    bindingSource: entry.bindingSource,
    status: 'reserved',
    chineseName: entry.zhName,
    commandSource: isAllegro ? 'allegro_builtin' : 'unknown',
    confidence: 'high',
    // 键名归一化
    primaryKey: entry.physicalKey,
    modifiers: entry.modifiers || [],
    displayKey: entry.displayKey || entry.rawKey,
    // 只读控制
    editable: false,
    warnWhenOverride: true,
    defaultOccupier: {
      command: entry.command || '(无默认命令)',
      description: entry.zhName,
      source: entry.bindingSource,
    },
  };
}

/**
 * 批量转换保留键条目到 HotkeyBinding[]。
 */
export function reservedEntriesToBindings(entries: ReservedKeyDataEntry[]): HotkeyBinding[] {
  return entries.map(reservedEntryToBinding);
}

/**
 * 一步完成：加载 JSON → 转为 HotkeyBinding[]。
 *
 * @param filePath - 可选 JSON 路径
 */
export function loadAndConvert(filePath?: string): { success: boolean; bindings: HotkeyBinding[]; error?: string } {
  const loadResult = loadDefaultReservedKeys(filePath);
  if (!loadResult.success) {
    return { success: false, bindings: [], error: loadResult.error };
  }
  return { success: true, bindings: reservedEntriesToBindings(loadResult.data) };
}
