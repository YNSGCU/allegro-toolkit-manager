/**
 * ATM - 默认保留键快捷键绑定生成器
 *
 * 将 default_reserved_keys.json 中的保留键数据转换为 HotkeyBinding[]
 * 用于在「软件默认/保留键」和「全部叠加」视图中展示。
 *
 * V2.2：使用静态 import 替代 fs.readFileSync，确保 JSON 在 tsc 编译时被复制到 dist。
 */
import defaultReservedKeysJson from './default_reserved_keys.json';
import type { HotkeyBinding, BindingSourceType } from '../../src/types/hotkey';

/** 保留键 JSON 条目结构 */
export interface ReservedKeyEntry {
  chineseName: string;
  defaultCommand: string;
  bindingType: string;
  category: string;
  description: string;
  allegroVersion: string;
}

/** 保留键 JSON 根结构 */
export interface ReservedKeysData {
  description: string;
  version: string;
  allegroVersions: string[];
  defaultVersion: string;
  reservedKeys: Record<string, ReservedKeyEntry>;
}

/**
 * 加载保留键数据（V2.2：直接返回 import 的数据）
 */
export function loadReservedKeysData(): ReservedKeysData {
  return defaultReservedKeysJson as any as ReservedKeysData;
}

/**
 * 根据 category 过滤保留键
 */
export function getReservedKeysByCategory(
  category: 'allegro_default' | 'system_reserved' | 'menu_accelerator',
): Record<string, ReservedKeyEntry> {
  const data = loadReservedKeysData();
  const result: Record<string, ReservedKeyEntry> = {};
  for (const [key, entry] of Object.entries(data.reservedKeys)) {
    if (entry.category === category) {
      result[key] = entry;
    }
  }
  return result;
}

/**
 * 获取所有保留键（按分类组织）
 */
export function getAllReservedKeys(): {
  allegroDefault: Record<string, ReservedKeyEntry>;
  systemReserved: Record<string, ReservedKeyEntry>;
  menuAccelerator: Record<string, ReservedKeyEntry>;
} {
  const data = loadReservedKeysData();
  const allegroDefault: Record<string, ReservedKeyEntry> = {};
  const systemReserved: Record<string, ReservedKeyEntry> = {};
  const menuAccelerator: Record<string, ReservedKeyEntry> = {};

  for (const [key, entry] of Object.entries(data.reservedKeys)) {
    switch (entry.category) {
      case 'allegro_default': allegroDefault[key] = entry; break;
      case 'system_reserved': systemReserved[key] = entry; break;
      case 'menu_accelerator': menuAccelerator[key] = entry; break;
    }
  }

  return { allegroDefault, systemReserved, menuAccelerator };
}

/**
 * 将保留键数据转换为 HotkeyBinding[]（只读）
 */
export function generateReservedBindings(
  categories?: Array<'allegro_default' | 'system_reserved' | 'menu_accelerator'>,
): HotkeyBinding[] {
  const data = loadReservedKeysData();
  const bindings: HotkeyBinding[] = [];
  let id = 0;

  for (const [key, entry] of Object.entries(data.reservedKeys)) {
    if (categories && !categories.includes(entry.category as any)) continue;

    const isAllegro = entry.category === 'allegro_default';
    const bindingSource: BindingSourceType = isAllegro ? 'allegro_default' : 'system_reserved';

    bindings.push({
      id: `reserved_${id++}`,
      key,
      command: entry.defaultCommand || '',
      type: entry.bindingType === 'alias' ? 'alias' : 'funckey',
      bindingSource,
      status: 'reserved',
      chineseName: entry.chineseName,
      description: entry.description,
      commandSource: isAllegro ? 'allegro_builtin' : 'unknown',
      confidence: 'high',
      // 只读控制
      editable: false,
      warnWhenOverride: true,
      visibleInUserMap: false,
      visibleInReservedMap: true,
      defaultOccupier: {
        command: entry.defaultCommand || '(无默认命令)',
        description: entry.description,
        source: entry.category,
      },
    });
  }

  return bindings;
}

/**
 * 查找某个键是否在保留键列表中
 */
export function findReservedKey(
  key: string,
): { entry: ReservedKeyEntry; category: string } | null {
  const data = loadReservedKeysData();
  const lowerKey = key.toLowerCase();
  for (const [rk, entry] of Object.entries(data.reservedKeys)) {
    if (rk.toLowerCase() === lowerKey) {
      return { entry, category: entry.category };
    }
  }
  return null;
}

/**
 * 检查用户绑定是否与保留键冲突
 * 返回冲突信息的数组
 */
export function checkReservedConflicts(
  userBindings: HotkeyBinding[],
): { userBinding: HotkeyBinding; reserved: ReservedKeyEntry; conflictType: string }[] {
  const conflicts: { userBinding: HotkeyBinding; reserved: ReservedKeyEntry; conflictType: string }[] = [];
  const data = loadReservedKeysData();

  for (const ub of userBindings) {
    const lowerKey = ub.key.toLowerCase();
    for (const [rk, entry] of Object.entries(data.reservedKeys)) {
      if (rk.toLowerCase() === lowerKey) {
        conflicts.push({
          userBinding: ub,
          reserved: entry,
          conflictType: ub.command === entry.defaultCommand ? 'same_command' : 'override',
        });
        break;
      }
    }
  }

  return conflicts;
}
