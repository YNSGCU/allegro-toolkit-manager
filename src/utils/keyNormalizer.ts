/**
 * ATM - 快捷键键名归一化工具
 *
 * 将 funckey 原始键名解析为 primaryKey、modifiers、displayKey。
 * 用于修饰键层筛选——用户点击 Ctrl/Shift/Alt 切换层时，
 * 通过 modifiers 字段匹配过滤。
 *
 * 修饰符前缀语法：
 *   ~   = Ctrl（波浪号前缀，紧跟键名）
 *   C   = Ctrl（字母前缀，后跟更多字符）
 *   S   = Shift（字母前缀，后跟更多字符）
 *   可组合：CS、SC、~S、~C
 *
 * 大写单字母（A-Z）→ 归入 Shift 层
 *
 * 大写单字母（A-Z）不再自动归入 Shift 层。
 * 只有 rawKey 中明确包含 Shift+ 前缀（如 "Shift+S"）或 Allegro S 前缀（如 "Ss"）时才被识别为 Shift。
 *
 * 示例：
 *   "c"    → { primaryKey: "c",   modifiers: [],             displayKey: "c" }
 *   "C"    → { primaryKey: "C",   modifiers: [],             displayKey: "C" }
 *   "S"    → { primaryKey: "S",   modifiers: [],             displayKey: "S" }
 *   "~c"   → { primaryKey: "c",   modifiers: ["Ctrl"],       displayKey: "Ctrl+c" }
 *   "Shift+S" → { primaryKey: "S", modifiers: ["Shift"],     displayKey: "Shift+S" }
 *   "F1"   → { primaryKey: "F1",  modifiers: [],             displayKey: "F1" }
 *   "CSF1" → { primaryKey: "F1",  modifiers: ["Ctrl","Shift"], displayKey: "Ctrl+Shift+F1" }
 */

export interface NormalizedKey {
  rawKey: string;
  primaryKey: string;
  modifiers: string[];
  displayKey: string;
}

/** 支持的修饰键类型 */
export type ModifierType = 'Ctrl' | 'Shift' | 'Alt';

/** 修饰键映射表（键盘 label → 修饰键名） */
export const MODIFIER_LABEL_MAP: Record<string, ModifierType> = {
  Ctrl: 'Ctrl',
  Shift: 'Shift',
  Alt: 'Alt',
};

/** 可被点击切换的修饰键 label 集合 */
export const MODIFIER_LABELS = new Set(Object.keys(MODIFIER_LABEL_MAP));

/**
 * 解析 funckey 原始键名，返回 primaryKey + modifiers + displayKey。
 * 对 alias 类型直接返回原始值（alias 不参与修饰键层筛选）。
 *
 * 支持两种修饰键前缀格式：
 * 1. Windows 风格： "Ctrl+C", "Shift+F1", "Alt+F4", "Ctrl+Shift+F1"
 * 2. Allegro 风格： "~c" (Ctrl), "C", "~C" (Ctrl+Shift), "CS" (Ctrl+Shift)
 */
export function normalizeKey(rawKey: string, type?: 'funckey' | 'alias'): NormalizedKey {
  // alias 不解析修饰前缀，直接返回
  if (type === 'alias') {
    return { rawKey, primaryKey: rawKey, modifiers: [], displayKey: rawKey };
  }

  let key = rawKey;
  const modifiers: string[] = [];

  // 1. 尝试匹配 Windows 风格 "Ctrl+", "Shift+", "Alt+" 前缀
  const winPrefixMatch = key.match(/^(Ctrl|Shift|Alt)([+])/i);
  if (winPrefixMatch) {
    // 解析多个 "Xxx+Yyy+..." 前缀
    while (true) {
      const m = key.match(/^(Ctrl|Shift|Alt)([+])/i);
      if (!m) break;
      const mod = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(); // Normalize case
      if (mod === 'Ctrl') modifiers.push('Ctrl');
      else if (mod === 'Shift') modifiers.push('Shift');
      else if (mod === 'Alt') modifiers.push('Alt');
      key = key.slice(m[0].length);
    }
    // Windows 风格解析完成
  } else {
    // 2. Allegro 风格：~ = Ctrl, C/Ctrl-prefix, S/Shift-prefix
    while (key.length > 1) {
      const first = key[0];
      if (first === '~') {
        modifiers.push('Ctrl');
        key = key.slice(1);
      } else if ((first === 'C' || first === 'c') && /[a-zA-Z0-9]/.test(key[1])) {
        modifiers.push('Ctrl');
        key = key.slice(1);
      } else if ((first === 'S' || first === 's') && /[a-zA-Z0-9]/.test(key[1])) {
        modifiers.push('Shift');
        key = key.slice(1);
      } else {
        break;
      }
    }
  }

  // 去重 + 排序（Ctrl 在前, Alt 在后）
  const uniqueMods = [...new Set(modifiers)].sort((a, b) => {
    if (a === 'Ctrl' && (b === 'Shift' || b === 'Alt')) return -1;
    if ((a === 'Shift' || a === 'Alt') && b === 'Ctrl') return 1;
    if (a === 'Shift' && b === 'Alt') return -1;
    if (a === 'Alt' && b === 'Shift') return 1;
    return 0;
  });

  const primaryKey = key;
  const displayKey = uniqueMods.length > 0
    ? [...uniqueMods, key].join('+')
    : key;

  return { rawKey, primaryKey, modifiers: uniqueMods, displayKey };
}

/**
 * 判断绑定的 modifiers 是否匹配当前激活的修饰键集合。
 *
 * 匹配规则：
 * - activeModifiers 为空时 → 只显示无修饰的绑定（普通层）
 * - activeModifiers 非空时 → 绑定必须包含 ALL 激活的修饰键（可包含更多）
 */
export function matchesModifiers(
  bindingModifiers: string[],
  activeModifiers: string[],
): boolean {
  if (activeModifiers.length === 0) {
    return bindingModifiers.length === 0;
  }
  return activeModifiers.every((m) => bindingModifiers.includes(m));
}

/**
 * 格式化显示层名称。
 * [] → "普通层"
 * ["Ctrl"] → "Ctrl 层"
 * ["Ctrl","Shift"] → "Ctrl+Shift 层"
 */
export function formatLayerName(activeModifiers: string[]): string {
  if (activeModifiers.length === 0) return '普通层';
  return [...activeModifiers].sort((a, b) => {
    if (a === 'Ctrl' && b === 'Shift') return -1;
    if (a === 'Shift' && b === 'Ctrl') return 1;
    return 0;
  }).join('+') + ' 层';
}
