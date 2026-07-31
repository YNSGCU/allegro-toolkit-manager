/**
 * ATM - 物理键归一化工具 & 共享来源标签配置（V2.2）
 *
 * 功能：
 *   1. 将原始键名归一化到物理键（如 s/S/CSs/Ctrl+S → physicalKey "S"）
 *   2. 按 physicalKey 过滤绑定（alias 不映射物理键）
 *   3. 按修饰键层过滤绑定
 *   4. 来源标签配置（供 KeyboardVisualizer / HotkeyList / PhysicalKeyBindingPanel 共享）
 *
 * V2.2 修正：大写字母 S/F/C 不再视为 Shift+S/Shift+F/Shift+C。
 * 只有 rawKey 中显式包含 Shift+ 前缀才算 Shift 修饰。
 */
import type { HotkeyBinding } from '../types/hotkey';
import { normalizeKey, matchesModifiers } from './keyNormalizer';

// ──────────── 归一化结果类型 ────────────

export interface NormalizedHotkeyKey {
  rawKey: string;
  physicalKey: string;
  displayKey: string;
  modifiers: string[];
  /** 大小写变体：upper / lower / none */
  caseVariant: 'upper' | 'lower' | 'none';
  /** 修饰键层标识：base / ctrl / shift / alt / combo */
  layer: string;
}

// ──────────── 共享来源标签配置 ────────────

export const BINDING_SRC_CONFIG: Record<string, { label: string; className: string }> = {
  user_env_original: { label: '用户原始 env', className: 'source-tag source-tag--unknown' },
  atm_managed_block: { label: 'ATM 托管块', className: 'source-tag source-tag--atm' },
  active_profile: { label: '当前方案', className: 'source-tag source-tag--user' },
  imported_profile: { label: '导入方案', className: 'source-tag source-tag--company' },
  generated: { label: '自动生成', className: 'source-tag source-tag--builtin' },
  install_default_env: { label: '安装默认 env', className: 'source-tag source-tag--default' },
  site_env: { label: 'Site 环境', className: 'source-tag source-tag--site' },
  company_env: { label: '公司环境', className: 'source-tag source-tag--company' },
  allegro_default: { label: 'Allegro 默认', className: 'source-tag source-tag--builtin' },
  system_reserved: { label: '系统保留', className: 'source-tag source-tag--warning' },
  reference_env: { label: '参考 env', className: 'source-tag source-tag--default' },
  menu_accelerator: { label: '菜单加速键', className: 'source-tag source-tag--builtin' },
  unknown: { label: '未知', className: 'source-tag source-tag--unknown' },
};

export const CMD_SRC_CONFIG: Record<string, { label: string; className: string }> = {
  allegro_builtin: { label: 'Allegro 内置', className: 'source-tag source-tag--builtin' },
  user_skill: { label: '本地 Skill', className: 'source-tag source-tag--user' },
  company_skill: { label: '公司 Skill', className: 'source-tag source-tag--company' },
  atm_managed_skill: { label: 'ATM 托管', className: 'source-tag source-tag--atm' },
  ambiguous: { label: '歧义', className: 'source-tag source-tag--warning' },
  unknown: { label: '未识别', className: 'source-tag source-tag--unknown' },
};

// ──────────── 归一化函数 ────────────

/** 判断是否为单字母 */
function isSingleLetter(s: string): boolean {
  return s.length === 1 && /[a-zA-Z]/.test(s);
}

function isKeyboardNamedKey(primaryKey: string): boolean {
  return /^(F\d{1,2}|Esc|Escape|Tab|Enter|Backspace|CapsLock|Shift|LShift|RShift|Ctrl|LCtrl|RCtrl|Alt|LAlt|RAlt|Win|Meta|Up|Down|Left|Right|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(
    primaryKey,
  );
}

function isKeyboardSymbolKey(primaryKey: string): boolean {
  return /^[0-9`~!@#$%^&*()_\-+=\[\]{}\\|;:'",.<>/?]$/.test(primaryKey);
}

function isKeyboardMappableAliasKey(rawKey: string): boolean {
  const normalized = normalizeKey(rawKey);
  const { primaryKey } = normalized;

  return (
    isSingleLetter(primaryKey) ||
    isKeyboardNamedKey(primaryKey) ||
    isKeyboardSymbolKey(primaryKey)
  );
}

/**
 * 将原始键名归一化为 physicalKey + displayKey + modifiers + caseVariant + layer。
 *
 * 规则（V2.2）：
 * - 大写单字母（S/F/C）不再视为 Shift+S/Shift+F/Shift+C。
 * - 只有 rawKey 中显式包含 Shift+ 前缀才算 Shift 修饰。
 * - physicalKey = 字母的大写形式（如 "S"、"F"），非字母原地返回。
 * - caseVariant = "upper"（大写字母）/ "lower"（小写字母）/ "none"（非字母）
 * - layer = "base"（无修饰）/ "ctrl" / "shift" / "alt" / "combo"（多修饰）
 *
 * 示例：
 *   "s"       → { physicalKey: "S", displayKey: "s",     modifiers:[], caseVariant:"lower", layer:"base" }
 *   "S"       → { physicalKey: "S", displayKey: "S",     modifiers:[], caseVariant:"upper", layer:"base" }
 *   "Ctrl+S"  → { physicalKey: "S", displayKey:"Ctrl+S", modifiers:["Ctrl"], caseVariant:"upper", layer:"ctrl" }
 *   "Shift+S" → { physicalKey: "S", displayKey:"Shift+S",modifiers:["Shift"],caseVariant:"upper", layer:"shift" }
 *   "~c"      → { physicalKey: "C", displayKey:"Ctrl+c", modifiers:["Ctrl"], caseVariant:"lower", layer:"ctrl" }
 *   "F1"      → { physicalKey:"F1", displayKey:"F1",     modifiers:[], caseVariant:"none", layer:"base" }
 *   alias "zs"→ { physicalKey:"zs", displayKey:"zs",     modifiers:[], caseVariant:"none", layer:"base" }
 */
export function normalizeHotkeyKey(rawKey: string, type?: 'funckey' | 'alias'): NormalizedHotkeyKey {
  if (type === 'alias') {
    if (!isKeyboardMappableAliasKey(rawKey)) {
      return {
        rawKey,
        physicalKey: rawKey,
        displayKey: rawKey,
        modifiers: [],
        caseVariant: 'none',
        layer: 'base',
      };
    }

    const nk = normalizeKey(rawKey);
    const primary = nk.primaryKey;
    const physicalKey = isSingleLetter(primary) ? primary.toUpperCase() : primary;
    let caseVariant: 'upper' | 'lower' | 'none' = 'none';
    if (isSingleLetter(primary)) {
      caseVariant = primary === primary.toUpperCase() ? 'upper' : 'lower';
    }

    let layer = 'base';
    if (nk.modifiers.length === 1) {
      layer = nk.modifiers[0].toLowerCase();
    } else if (nk.modifiers.length > 1) {
      layer = 'combo';
    }

    return {
      rawKey,
      physicalKey,
      displayKey: nk.displayKey,
      modifiers: nk.modifiers,
      caseVariant,
      layer,
    };
  }

  const nk = normalizeKey(rawKey, type);

  // physicalKey = 单字母统一大写，非字母保留原值
  const primary = nk.primaryKey;
  const physicalKey = isSingleLetter(primary) ? primary.toUpperCase() : primary;

  // caseVariant
  let caseVariant: 'upper' | 'lower' | 'none' = 'none';
  if (isSingleLetter(primary)) {
    caseVariant = primary === primary.toUpperCase() ? 'upper' : 'lower';
  }

  // layer
  const mods = nk.modifiers;
  let layer = 'base';
  if (mods.length === 1) {
    layer = mods[0].toLowerCase();
  } else if (mods.length > 1) {
    layer = 'combo';
  }

  return {
    rawKey,
    physicalKey,
    displayKey: nk.displayKey,
    modifiers: mods,
    caseVariant,
    layer,
  };
}

/**
 * 给 HotkeyBinding 添加 physicalKey / caseVariant / layer 等归一化字段。
 */
export function enrichWithPhysicalKey(binding: HotkeyBinding): HotkeyBinding & { physicalKey?: string; caseVariant?: string; layer?: string } {
  const nk = normalizeHotkeyKey(binding.key, binding.type);
  return {
    ...binding,
    physicalKey: nk.physicalKey,
    displayKey: nk.displayKey || binding.displayKey,
    modifiers: nk.modifiers,
    caseVariant: nk.caseVariant,
    layer: nk.layer,
  };
}

/**
 * 按 physicalKey 筛选绑定列表。
 * 只包含 funckey 类型（alias 不映射物理键）。
 */
export function getBindingsByPhysicalKey(
  bindings: HotkeyBinding[],
  physicalKey: string,
): HotkeyBinding[] {
  const upperKey = physicalKey.toUpperCase();
  return bindings.filter((b) => {
    const pk = b.primaryKey
      ? b.primaryKey.toUpperCase()
      : normalizeHotkeyKey(b.key, b.type).physicalKey.toUpperCase();
    return pk === upperKey;
  });
}

/**
 * 按修饰键层筛选绑定。
 */
export function filterBindingsByModifiers(
  bindings: HotkeyBinding[],
  activeModifiers: string[],
): HotkeyBinding[] {
  return bindings.filter((b) => {
    if (b.type === 'alias') return true;
    return matchesModifiers(b.modifiers || [], activeModifiers);
  });
}

// ──────────── 图层系统（V3.0 — 修复切换逻辑） ────────────

/** 图层标识 */
export type ActiveLayer = 'normal' | 'uppercase' | 'ctrl' | 'alt' | 'special';

/** 图层配置：标识 → 显示名 + 对应修饰键 */
export const LAYER_CONFIG: Record<ActiveLayer, { label: string; modifiers: string[] }> = {
  normal: { label: '普通', modifiers: [] },
  uppercase: { label: '大写', modifiers: [] },
  ctrl: { label: 'Ctrl', modifiers: ['Ctrl'] },
  alt: { label: 'Alt', modifiers: ['Alt'] },
  special: { label: '特殊', modifiers: ['Shift'] },
};

/**
 * 根据 keyboardLayer 过滤快捷键。
 *
 * 规则（V3.0）：
 * - "normal"（普通层）：modifiers=[] 且 caseVariant≠"upper"
 *   即小写字母（s/f/c/v）+ 非字母键（F1/数字等）
 * - "uppercase"（大写层）：modifiers=[] 且 caseVariant="upper"
 *   即大写单字母（S/F/C/V）
 * - "ctrl"：modifiers 包含 Ctrl
 * - "alt"：modifiers 包含 Alt
 * - "special"：layer==="special" 或 modifiers 包含 Shift（不含 Ctrl/Alt）
 */
export function filterHotkeysByKeyboardLayer(
  hotkeys: HotkeyBinding[],
  keyboardLayer: ActiveLayer,
): HotkeyBinding[] {
  return hotkeys.filter((item) => {
    const normalized = normalizeHotkeyKey(item.key, item.type);
    const mods = item.modifiers ?? normalized.modifiers;
    const cv = item.caseVariant ?? normalized.caseVariant;
    const layer = item.layer ?? normalized.layer;

    if (keyboardLayer === 'normal') {
      // 普通层：无修饰键 + 非大写字母
      return mods.length === 0 && cv !== 'upper';
    }
    if (keyboardLayer === 'uppercase') {
      // 大写层：无修饰键 + 大写字母
      return mods.length === 0 && cv === 'upper';
    }
    if (keyboardLayer === 'ctrl') {
      // Ctrl 层：modifiers 包含 Ctrl
      return mods.includes('Ctrl');
    }
    if (keyboardLayer === 'alt') {
      // Alt 层：modifiers 包含 Alt
      return mods.includes('Alt');
    }
    if (keyboardLayer === 'special') {
      // 特殊层：layer 为 special 或 包含 Shift（不含 Ctrl/Alt）
      return layer === 'special' || (mods.includes('Shift') && !mods.includes('Ctrl') && !mods.includes('Alt'));
    }
    return true;
  });
}

/**
 * 获取当前图层的显示名。
 */
export function getLayerDisplayName(activeLayer: ActiveLayer): string {
  switch (activeLayer) {
    case 'normal': return '普通层';
    case 'uppercase': return '大写层';
    case 'ctrl': return 'Ctrl 层';
    case 'alt': return 'Alt 层';
    case 'special': return '特殊层';
    default: return '普通层';
  }
}

/**
 * 判断绑定是否为只读（allegro_default / system_reserved）。
 */
export function isReadonlyBinding(binding: HotkeyBinding): boolean {
  return (
    binding.bindingSource === 'allegro_default' ||
    binding.bindingSource === 'system_reserved'
  );
}

/**
 * 获取修饰键层显示名。
 *
 * V2.2 规则：
 * - modifiers=[], caseVariant="upper" → "大写"
 * - modifiers=[], caseVariant="lower" → "小写"
 * - modifiers=[], caseVariant="none"  → "普通层"
 * - modifiers=["Ctrl"]               → "Ctrl 层"
 * - modifiers=["Shift"]              → "Shift 层"
 * - modifiers=["Alt"]                → "Alt 层"
 * - 多个修饰符                       → "Ctrl+Shift 层"
 */
export function getLayerLabel(modifiers: string[], caseVariant?: string): string {
  if (modifiers.length === 0) {
    if (caseVariant === 'upper') return '大写';
    if (caseVariant === 'lower') return '小写';
    return '普通层';
  }
  if (modifiers.length === 1) return modifiers[0] + ' 层';
  return modifiers.join('+') + ' 层';
}
