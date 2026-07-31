/**
 * ATM - 可用快捷键推荐器 (Available Key Recommender)
 *
 * 分析当前绑定、保留键和系统保留键，推荐可用的未占用按键
 * 供用户为新快捷键绑定选择。
 *
 * V3.0 — 综合推荐算法
 * - 优先级排序：F键 > Ctrl组合 > Alt组合 > 小写字母 > 大写字母 > 其他
 * - 大写字母仅在其对应小写字母已被占用时推荐，作为替代方案
 * - 保留键/系统键/已占用键会被标记状态和原因，帮助用户了解不可用原因
 */

import type { HotkeyBinding } from '../../src/types/hotkey';

// ═══════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════

export interface KeyRecommendation {
  key: string;          // raw key format, e.g. "F8", "Ctrl+F8", "s", "S"
  displayKey: string;   // display format, e.g. "F8", "Ctrl+F8", "s", "S"
  status: 'available' | 'occupied' | 'reserved' | 'system' | 'profile_used';
  occupiedBy?: string;  // what occupies it (command name)
  reason?: string;      // Chinese explanation
  priority: number;     // 0-5, lower = better recommendation
  category: 'function_key' | 'ctrl_combo' | 'alt_combo' | 'lowercase' | 'uppercase' | 'other';
}

export interface RecommendationOptions {
  excludeKeys: string[];         // keys to exclude (e.g. already in edit form)
  currentBindings: HotkeyBinding[];
  reservedBindings: HotkeyBinding[];
  profileBindings: HotkeyBinding[];
  includeCategories: string[];   // categories to include
  maxResults: number;            // max recommendations (default 12)
}

// ═══════════════════════════════════════════════
// 保留键常量
// ═══════════════════════════════════════════════

export const SYSTEM_RESERVED_KEYS: string[] = [
  'Esc', 'Escape', 'Enter', 'Return', 'Delete', 'Backspace',
  'Tab', 'Space', 'Pause', 'Break', 'PrintScreen',
  'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'NumLock', 'ScrollLock', 'CapsLock',
];

export const SYSTEM_RESERVED_COMBOS: string[] = [
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+A',
  'Ctrl+S', 'Ctrl+W', 'Ctrl+Q', 'Ctrl+Shift+Esc',
  'Alt+F4', 'Alt+Tab', 'Alt+Space',
  'Ctrl+Alt+Del',
];

export const ALLEGRO_DEFAULT_WARN: string[] = [
  'F1', 'F2', 'F3', 'F4', 'F5',
];

// ═══════════════════════════════════════════════
// 备选按键列表（构建时生成归一化信息）
// ═══════════════════════════════════════════════

interface CandidateKey {
  key: string;
  displayKey: string;
  category: KeyRecommendation['category'];
  basePriority: number;
}

const CANDIDATE_KEYS: CandidateKey[] = [
  // F6-F12（F1-F5 排除，作为 Allegro 默认警告键）
  { key: 'F6', displayKey: 'F6', category: 'function_key', basePriority: 0 },
  { key: 'F7', displayKey: 'F7', category: 'function_key', basePriority: 0 },
  { key: 'F8', displayKey: 'F8', category: 'function_key', basePriority: 0 },
  { key: 'F9', displayKey: 'F9', category: 'function_key', basePriority: 0 },
  { key: 'F10', displayKey: 'F10', category: 'function_key', basePriority: 0 },
  { key: 'F11', displayKey: 'F11', category: 'function_key', basePriority: 0 },
  { key: 'F12', displayKey: 'F12', category: 'function_key', basePriority: 0 },
  // Ctrl+letter (A-Z)
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => ({
    key: `~${c.toLowerCase()}`,
    displayKey: `Ctrl+${c}`,
    category: 'ctrl_combo' as const,
    basePriority: 1,
  })),
  // Alt+letter (A-Z)
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => ({
    key: `Alt+${c}`,
    displayKey: `Alt+${c}`,
    category: 'alt_combo' as const,
    basePriority: 2,
  })),
  // Lowercase a-z
  ...'abcdefghijklmnopqrstuvwxyz'.split('').map(c => ({
    key: c,
    displayKey: c,
    category: 'lowercase' as const,
    basePriority: 3,
  })),
  // Uppercase A-Z
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => ({
    key: c,
    displayKey: c,
    category: 'uppercase' as const,
    basePriority: 4,
  })),
];

// ═══════════════════════════════════════════════
// 键名归一化辅助（简化版，不依赖前端 src/utils 工具）
// ═══════════════════════════════════════════════

/** 归一化中间结果 */
interface NormalizedKeyInfo {
  primaryKey: string;
  modifiers: string[];
  /** 归一化比较键：用于哈希匹配 */
  comparisonKey: string;
}

/**
 * 将按键名归一化为 primaryKey + modifiers + comparisonKey。
 *
 * 支持两种修饰键前缀格式：
 * 1. Windows 风格： "Ctrl+C", "Shift+F1", "Alt+F4"
 * 2. Allegro 风格： "~c" (Ctrl), "C" 前缀 (Ctrl), "S" 前缀 (Shift)
 *
 * comparisonKey 格式：
 * - 无修饰键：直接返回 primaryKey（不归一化大小写）
 * - 有修饰键：`Mod1+Mod2|primaryKey.toLowerCase()`
 */
function normalizeKeyForMatch(key: string, type?: string): NormalizedKeyInfo {
  // alias 类型不解析修饰前缀，直接返回
  if (type === 'alias') {
    return { primaryKey: key, modifiers: [], comparisonKey: key };
  }

  let workingKey = key;
  const modifiers: string[] = [];

  // 1. 尝试匹配 Windows 风格 "Ctrl+", "Shift+", "Alt+" 前缀
  const winPrefixMatch = workingKey.match(/^(Ctrl|Shift|Alt)([+])/i);
  if (winPrefixMatch) {
    while (true) {
      const m = workingKey.match(/^(Ctrl|Shift|Alt)([+])/i);
      if (!m) break;
      const mod = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      modifiers.push(mod);
      workingKey = workingKey.slice(m[0].length);
    }
  } else {
    // 2. Allegro 风格：~ = Ctrl, C/Ctrl-prefix, S/Shift-prefix
    while (workingKey.length > 1) {
      const first = workingKey[0];
      if (first === '~') {
        modifiers.push('Ctrl');
        workingKey = workingKey.slice(1);
      } else if ((first === 'C' || first === 'c') && /[a-zA-Z0-9]/.test(workingKey[1])) {
        modifiers.push('Ctrl');
        workingKey = workingKey.slice(1);
      } else if ((first === 'S' || first === 's') && /[a-zA-Z0-9]/.test(workingKey[1])) {
        modifiers.push('Shift');
        workingKey = workingKey.slice(1);
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

  const primaryKey = workingKey;

  // 构建比较键
  let comparisonKey: string;
  if (uniqueMods.length > 0) {
    comparisonKey = `${uniqueMods.join('+')}|${primaryKey.toLowerCase()}`;
  } else {
    comparisonKey = primaryKey;
  }

  return { primaryKey, modifiers: uniqueMods, comparisonKey };
}

// ═══════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════

/**
 * 检查某个按键或按键组合是否为系统保留键。
 *
 * 匹配规则：
 * 1. 直接比较 key / displayKey 与 SYSTEM_RESERVED_KEYS
 * 2. 直接比较 key / displayKey 与 SYSTEM_RESERVED_COMBOS
 * 3. 从归一化角度比较（处理 ~c → Ctrl+C 等等价形式）
 */
export function isSystemReserved(key: string, displayKey: string): boolean {
  const lowerKey = key.toLowerCase();
  const lowerDisplay = displayKey.toLowerCase();

  // 直接检查 SYSTEM_RESERVED_KEYS
  for (const rk of SYSTEM_RESERVED_KEYS) {
    if (rk.toLowerCase() === lowerKey || rk.toLowerCase() === lowerDisplay) {
      return true;
    }
  }

  // 直接检查 SYSTEM_RESERVED_COMBOS
  for (const combo of SYSTEM_RESERVED_COMBOS) {
    const lowerCombo = combo.toLowerCase();
    if (lowerCombo === lowerKey || lowerCombo === lowerDisplay) {
      return true;
    }
  }

  // 从归一化角度检查（处理 ~c / Ctrl+C 等价形式）
  const nk = normalizeKeyForMatch(key);
  for (const combo of SYSTEM_RESERVED_COMBOS) {
    const cn = normalizeKeyForMatch(combo);
    if (
      cn.modifiers.length === nk.modifiers.length &&
      cn.modifiers.every((m) => nk.modifiers.includes(m)) &&
      cn.primaryKey.toLowerCase() === nk.primaryKey.toLowerCase()
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 检查某个按键是否为 Allegro 默认占用的功能键（F1-F5）。
 * 覆盖这些键会触发警告。
 */
export function isAllegroDefaultWarn(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return ALLEGRO_DEFAULT_WARN.some((dk) => dk.toLowerCase() === lowerKey);
}

/**
 * 获取所有已占用的快捷键映射表（key → command）。
 * 只包含 funckey 类型，alias 不参与物理键占用。
 * 返回的 Map 使用绑定原始 key 作为键名。
 */
export function getOccupiedKeys(bindings: HotkeyBinding[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of bindings) {
    if (b.type !== 'funckey') continue;
    if (!map.has(b.key)) {
      map.set(b.key, b.command);
    }
  }
  return map;
}

/**
 * 判断是否为单字母
 */
function isSingleLetter(s: string): boolean {
  return s.length === 1 && /[a-zA-Z]/.test(s);
}

/**
 * 判断候选键的归一化形式是否与某个绑定匹配。
 */
function doesBindingMatchCandidate(
  binding: HotkeyBinding,
  candidateNorm: NormalizedKeyInfo,
  candidateIsLetter: boolean,
): boolean {
  if (binding.type === 'alias') return false;

  // 使用已有的 primaryKey / modifiers 字段（优先），否则实时归一化
  let bindingModifiers: string[];
  let bindingPrimaryKey: string;

  if (binding.modifiers && binding.primaryKey) {
    bindingModifiers = binding.modifiers;
    bindingPrimaryKey = binding.primaryKey;
  } else {
    const nk = normalizeKeyForMatch(binding.key, binding.type);
    bindingModifiers = nk.modifiers;
    bindingPrimaryKey = nk.primaryKey;
  }

  // 先检查修饰键是否一致
  if (candidateNorm.modifiers.length !== bindingModifiers.length) return false;
  for (const m of candidateNorm.modifiers) {
    if (!bindingModifiers.includes(m)) return false;
  }

  // 无修饰键的按键匹配
  if (candidateNorm.modifiers.length === 0) {
    // 单字母：大小写敏感（s 和 S 是不同的按键层）
    if (candidateIsLetter) {
      return bindingPrimaryKey === candidateNorm.primaryKey;
    }
    // 功能键等非字母键：大小写不敏感
    return bindingPrimaryKey.toLowerCase() === candidateNorm.primaryKey.toLowerCase();
  }

  // 有修饰键的组合键：大小写不敏感
  return bindingPrimaryKey.toLowerCase() === candidateNorm.primaryKey.toLowerCase();
}

/**
 * 在绑定列表中查找匹配候选键且 warnWhenOverride 为 true 的绑定。
 */
function findReservedBinding(
  bindings: HotkeyBinding[],
  candidateNorm: NormalizedKeyInfo,
  candidateIsLetter: boolean,
): HotkeyBinding | undefined {
  for (const b of bindings) {
    if (b.warnWhenOverride && doesBindingMatchCandidate(b, candidateNorm, candidateIsLetter)) {
      return b;
    }
  }
  return undefined;
}

/**
 * 从保留绑定列表（reservedBindings）中收集所有需要标记为 'reserved' 的 comparisonKey 集合。
 */
function buildReservedComparisonKeys(bindings: HotkeyBinding[]): Set<string> {
  const set = new Set<string>();
  for (const b of bindings) {
    if (b.type === 'alias' || !b.warnWhenOverride) continue;
    const nk = normalizeKeyForMatch(b.key, b.type);
    set.add(nk.comparisonKey);
  }
  return set;
}

/**
 * 从当前绑定列表（currentBindings）收集所有已占用键的 comparisonKey 集合。
 */
function buildOccupiedComparisonKeys(bindings: HotkeyBinding[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of bindings) {
    if (b.type === 'alias') continue;
    const nk = normalizeKeyForMatch(b.key, b.type);
    if (!map.has(nk.comparisonKey)) {
      map.set(nk.comparisonKey, b.command);
    }
  }
  return map;
}

// ═══════════════════════════════════════════════
// 核心推荐函数
// ═══════════════════════════════════════════════

/**
 * 推荐可用快捷键。
 *
 * 优先级顺序（数值越小越优先推荐）：
 *   0. F6-F12（未被占用）— 功能键是最优选择
 *   1. Ctrl+字母组合（未被占用）
 *   2. Alt+字母组合（未被占用）
 *   3. 小写字母 a-z（未被占用）
 *   4. 大写字母 A-Z（仅在其对应小写字母已被占用时推荐）
 *   5. 其他按键（预留）
 *
 * 返回结果按优先级排序，相同优先级下可用键先于被占用键，
 * 再按按键字母顺序排列。
 *
 * @param options - 推荐选项
 * @returns 推荐按键列表，按优先级排序
 */
export function getRecommendedKeys(options: RecommendationOptions): KeyRecommendation[] {
  const {
    excludeKeys,
    currentBindings,
    reservedBindings,
    profileBindings,
    includeCategories,
    maxResults = 12,
  } = options;

  // ── 构建预计算查找表 ──

  // 排除键集合（大小写不敏感）
  const excludeSet = new Set<string>();
  for (const ek of excludeKeys) {
    excludeSet.add(ek.toLowerCase());
  }

  // 已占用键的 comparisonKey → command 映射
  const occupiedMap = buildOccupiedComparisonKeys(currentBindings);

  // 保留键（warnWhenOverride=true）的 comparisonKey 集合
  const reservedSet = buildReservedComparisonKeys(reservedBindings);

  // 方案已用键的 comparisonKey → command 映射
  const profileOccupiedMap = buildOccupiedComparisonKeys(profileBindings);

  // 小写字母被占用情况（用于决定是否推荐大写字母）
  const lowercaseOccupied = new Set<string>();
  for (const c of 'abcdefghijklmnopqrstuvwxyz') {
    if (occupiedMap.has(c)) {
      // 小写字母的 comparisonKey 就是它本身（无修饰键）
      lowercaseOccupied.add(c);
    }
  }

  // ── 处理每个候选键 ──

  const results: KeyRecommendation[] = [];

  for (const candidate of CANDIDATE_KEYS) {
    const { key, displayKey, category, basePriority } = candidate;

    // 按 includeCategories 过滤
    if (includeCategories.length > 0 && !includeCategories.includes(category)) {
      continue;
    }

    // 排除键过滤
    if (excludeSet.has(key.toLowerCase()) || excludeSet.has(displayKey.toLowerCase())) {
      continue;
    }

    // 大写字母特殊处理：仅在其对应小写字母已被占用时推荐
    if (category === 'uppercase') {
      const lowerLetter = key.toLowerCase();
      if (!lowercaseOccupied.has(lowerLetter)) {
        continue; // 小写未被占用，不推荐大写（用户应直接使用小写）
      }
    }

    // 归一化候选键
    const candidateNorm = normalizeKeyForMatch(key);
    const candidateIsLetter = isSingleLetter(candidateNorm.primaryKey);

    // ── 判断状态 ──

    let status: KeyRecommendation['status'];
    let occupiedBy: string | undefined;
    let reason: string | undefined;

    // 1. 系统保留键（不可用，不推荐）
    if (isSystemReserved(key, displayKey)) {
      status = 'system';
      reason = `系统保留键 (${displayKey})`;
    }
    // 2. Allegro 默认占用键（F1-F5，覆盖会警告）
    else if (isAllegroDefaultWarn(key) || isAllegroDefaultWarn(displayKey)) {
      status = 'system';
      reason = `Allegro 默认占用键 (${displayKey})，覆盖可能导致冲突`;
    }
    // 3. 软件保留键（来自 reservedBindings 且 warnWhenOverride）
    else if (reservedSet.has(candidateNorm.comparisonKey)) {
      status = 'reserved';
      const existing = findReservedBinding(reservedBindings, candidateNorm, candidateIsLetter);
      reason = existing ? `软件保留键 — ${existing.chineseName || existing.command}` : '软件保留键';
    }
    // 4. 当前绑定中的已占用键
    else if (occupiedMap.has(candidateNorm.comparisonKey)) {
      status = 'occupied';
      occupiedBy = occupiedMap.get(candidateNorm.comparisonKey) || '(已占用)';
      reason = `已被占用 — ${occupiedBy}`;
    }
    // 5. 当前方案中的已占用键
    else if (profileOccupiedMap.has(candidateNorm.comparisonKey)) {
      status = 'profile_used';
      const cmd = profileOccupiedMap.get(candidateNorm.comparisonKey);
      reason = `当前方案已使用 — ${cmd || '(已占用)'}`;
    }
    // 6. 可用
    else {
      status = 'available';
      reason = '可用';
    }

    results.push({
      key,
      displayKey,
      status,
      occupiedBy,
      reason,
      priority: basePriority,
      category,
    });
  }

  // ── 排序 ──
  // 1. 优先级升序（0 最优先）
  // 2. 状态排序：available < profile_used < occupied < reserved < system
  // 3. 按键字母顺序

  const statusOrder: Record<string, number> = {
    available: 0,
    profile_used: 1,
    occupied: 2,
    reserved: 3,
    system: 4,
  };

  results.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aOrder = statusOrder[a.status] ?? 5;
    const bOrder = statusOrder[b.status] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.key.localeCompare(b.key);
  });

  // ── 限制返回数量 ──
  if (results.length > maxResults) {
    return results.slice(0, maxResults);
  }

  return results;
}
