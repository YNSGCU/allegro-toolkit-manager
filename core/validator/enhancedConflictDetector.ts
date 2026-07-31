/**
 * ATM - Enhanced Conflict Detector
 *
 * Extends the basic conflict detection in validateHotkeys.ts with more
 * sophisticated conflict types for the hotkey management page.
 *
 * Design rules:
 * - All functions are pure (no side effects, no fs access)
 * - Graceful handling of missing/empty data
 * - All types properly exported
 * - No direct file writes
 */

import type { HotkeyBinding, Conflict, BindingSourceType } from '../../src/types/hotkey';
import type { CommandIndex } from '../skill/commandIndex';

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Conflict severity type (defined locally; not yet exported from shared types) */
export type ConflictSeverity = 'error' | 'warning' | 'info';

// ─── 1. EnhancedConflict Interface ───────────────────────────────────────────

export interface EnhancedConflict extends Conflict {
  /** Unique identifier (hash of subType + key + message) */
  id: string;

  /** Granular sub-type for grouping and filtering */
  subType:
    | 'same_env_duplicate'
    | 'reserved_key_override'
    | 'unrecognized_command'
    | 'skill_not_loaded'
    | 'cross_env_override'
    | 'profile_override_env'
    | 'funckey_duplicate'
    | 'alias_duplicate'
    | 'alias_prefix'
    | 'cross_type_same_name';

  /** Override severity for stricter typing */
  severity: ConflictSeverity;

  /** Actionable suggestions (Chinese strings) */
  suggestions: string[];

  /** Whether the user can safely ignore this conflict */
  ignoreable: boolean;

  /** Keys involved in this conflict (e.g. ['F1', 'a']) */
  involvedKeys: string[];

  /** File paths or env IDs involved */
  involvedFiles: string[];

  /** Source env file ID (if applicable) */
  envSourceId?: string;
}

// ─── 2. ConflictMatrix Interface ─────────────────────────────────────────────

export interface ConflictMatrix {
  /** Conflicts grouped by subType */
  byType: Record<string, EnhancedConflict[]>;

  /** Conflicts grouped by severity */
  bySeverity: {
    errors: EnhancedConflict[];
    warnings: EnhancedConflict[];
    infos: EnhancedConflict[];
  };

  /** Conflicts grouped by primary key name */
  byKey: Record<string, EnhancedConflict[]>;

  /** Total number of conflicts (after ignore list filtering) */
  totalCount: number;

  /** IDs of conflicts marked as ignorable */
  ignoreList: string[];
}

// ─── 3. EnhancedConflictParams Interface ─────────────────────────────────────

export interface EnhancedConflictParams {
  /** All hotkey bindings to scan */
  bindings: HotkeyBinding[];

  /** Reserved/system key bindings (from default_reserved_keys.json) */
  reservedBindings: HotkeyBinding[];

  /** Path to the active user env file (optional, for context) */
  userEnvPath?: string;

  /** Bindings from reference env files (for cross-env detection) */
  referenceEnvBindings?: HotkeyBinding[];

  /** Bindings from the active profile (for profile-vs-env detection) */
  profileBindings?: HotkeyBinding[];

  /** Skill command registry for command validation */
  commandRegistery?: Record<string, any>;

  /** Map of skillName -> load status */
  skillLoadStatuses?: Record<string, string>;

  /** IDs of conflicts the user has chosen to ignore */
  conflictIgnoreList?: string[];

  /** V5.1 CommandIndex: 用于源字段未填充时的 fallback 分类 */
  commandIndex?: CommandIndex;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Generate a deterministic pseudo-hash ID for a conflict.
 * Format: conflict_<hex-hash>
 */
function generateConflictId(subType: string, key: string, message: string): string {
  const raw = `${subType}|${key}|${message}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // force 32-bit integer
  }
  return `conflict_${Math.abs(hash).toString(16)}`;
}

/**
 * Extract unique involved key strings from a set of bindings.
 * Uses primaryKey when available, falls back to raw key.
 */
function extractInvolvedKeys(bindings: HotkeyBinding[]): string[] {
  const keys = new Set<string>();
  for (const b of bindings) {
    if (b.primaryKey) {
      keys.add(b.primaryKey);
    } else if (b.key) {
      keys.add(b.key.length === 1 && /[a-zA-Z]/.test(b.key) ? b.key.toUpperCase() : b.key);
    }
  }
  return Array.from(keys);
}

/**
 * Extract unique involved file/environment identifiers from a set of bindings.
 */
function extractInvolvedFiles(bindings: HotkeyBinding[]): string[] {
  const files = new Set<string>();
  for (const b of bindings) {
    if (b.envSourceId) files.add(b.envSourceId);
    if (b.skillFilePath) files.add(b.skillFilePath);
  }
  return Array.from(files);
}

/**
 * Determine the primary key for a binding (used for byKey grouping).
 * - Uses primaryKey if available (uppercased)
 * - Uses raw key for single letters (uppercased)
 * - Falls back to full key name
 */
function resolvePrimaryKey(binding: HotkeyBinding): string {
  if (binding.primaryKey) return binding.primaryKey.toUpperCase();
  if (binding.key) {
    const k = binding.key.trim();
    if (k.length === 1 && /[a-zA-Z]/.test(k)) return k.toUpperCase();
    return k;
  }
  return 'unknown';
}

/**
 * Map a base Conflict type to an EnhancedConflict subType.
 */
function mapBaseTypeToSubType(type: Conflict['type']): EnhancedConflict['subType'] {
  switch (type) {
    case 'funckey_duplicate':
      return 'funckey_duplicate';
    case 'alias_duplicate':
      return 'alias_duplicate';
    case 'alias_prefix':
      return 'alias_prefix';
    case 'cross_type_same_name':
      return 'cross_type_same_name';
    case 'missing_command':
      return 'unrecognized_command';
    case 'reserved_key':
    case 'reserved_key_warning':
      return 'reserved_key_override';
    case 'skill_unloaded':
      return 'skill_not_loaded';
    case 'cross_env_override':
      return 'cross_env_override';
    default:
      return 'unrecognized_command';
  }
}

// ─── 4. detectEnhancedConflicts ──────────────────────────────────────────────

/**
 * Detect enhanced conflicts across all provided bindings and data sources.
 *
 * Detection order:
 *   1. Basic conflicts (funckey_duplicate, alias_duplicate, alias_prefix, cross_type)
 *   2. Enhanced conflicts (same_env_duplicate, reserved_key_override, etc.)
 *
 * @returns A ConflictMatrix with all detected conflicts, grouped for easy consumption.
 */
export function detectEnhancedConflicts(params: EnhancedConflictParams): ConflictMatrix {
  const {
    bindings = [],
    reservedBindings = [],
    userEnvPath,
    referenceEnvBindings = [],
    profileBindings = [],
    commandRegistery = {},
    skillLoadStatuses = {},
    conflictIgnoreList = [],
  } = params;

  const ignoreSet = new Set(conflictIgnoreList);
  const conflicts: EnhancedConflict[] = [];
  const addedSignatures = new Set<string>();

  /**
   * Helper to add a conflict if it passes ignore-list check and dedup check.
   */
  function addConflict(conflict: EnhancedConflict): void {
    if (ignoreSet.has(conflict.id)) return;

    const sig = `${conflict.subType}:${conflict.bindings.map((b) => b.key).join(',')}:${conflict.message}`;
    if (addedSignatures.has(sig)) return;
    addedSignatures.add(sig);

    conflicts.push(conflict);
  }

  // ──────────── Step 1: Basic Conflict Detection ────────────

  // 1a. Funckey duplicates — same key, different commands
  const funckeyBindings = bindings.filter((b) => b.type === 'funckey');
  const funckeyByKey = groupByKey(funckeyBindings);
  for (const [key, group] of funckeyByKey) {
    if (group.length < 2) continue;
    const commands = new Set(group.map((b) => b.command?.trim()).filter(Boolean));
    if (commands.size <= 1) continue;

    addConflict({
      id: generateConflictId('funckey_duplicate', key, `funckey 按键 "${key}" 存在多个绑定`),
      type: 'funckey_duplicate',
      subType: 'funckey_duplicate',
      severity: 'error',
      message: `funckey 按键 "${key}" 存在 ${group.length} 个绑定，命令不同`,
      bindings: group,
      suggestions: ['编辑或删除其中一条重复绑定'],
      ignoreable: false,
      involvedKeys: extractInvolvedKeys(group),
      involvedFiles: extractInvolvedFiles(group),
    });
  }

  // 1b. Alias duplicates — same name, different commands
  const aliasBindings = bindings.filter((b) => b.type === 'alias');
  const aliasByKey = groupByKey(aliasBindings);
  for (const [key, group] of aliasByKey) {
    if (group.length < 2) continue;
    const commands = new Set(group.map((b) => b.command?.trim()).filter(Boolean));
    if (commands.size <= 1) continue;

    addConflict({
      id: generateConflictId('alias_duplicate', key, `alias "${key}" 存在多个定义`),
      type: 'alias_duplicate',
      subType: 'alias_duplicate',
      severity: 'error',
      message: `alias "${key}" 存在 ${group.length} 个定义，命令不同`,
      bindings: group,
      suggestions: ['编辑或删除其中一条重复定义'],
      ignoreable: false,
      involvedKeys: extractInvolvedKeys(group),
      involvedFiles: extractInvolvedFiles(group),
    });
  }

  // 1c. Alias prefix — one alias name is a prefix of another
  const aliasKeys = [...new Set(aliasBindings.map((b) => b.key).filter((k): k is string => !!k))];
  for (let i = 0; i < aliasKeys.length; i++) {
    for (let j = 0; j < aliasKeys.length; j++) {
      if (i === j) continue;
      const shortKey = aliasKeys[i];
      const longKey = aliasKeys[j];
      if (!longKey.startsWith(shortKey) || longKey === shortKey) continue;

      const shortGroup = aliasBindings.filter((b) => b.key === shortKey);
      const longGroup = aliasBindings.filter((b) => b.key === longKey);
      const related = [...shortGroup, ...longGroup];

      addConflict({
        id: generateConflictId('alias_prefix', shortKey, `alias 前缀关系: "${shortKey}" 是 "${longKey}" 的前缀`),
        type: 'alias_prefix',
        subType: 'alias_prefix',
        severity: 'warning',
        message: `alias 前缀关系: "${shortKey}" 是 "${longKey}" 的前缀`,
        bindings: related,
        suggestions: ['确认两个别名的前缀关系是否符合预期'],
        ignoreable: true,
        involvedKeys: extractInvolvedKeys(related),
        involvedFiles: extractInvolvedFiles(related),
      });
    }
  }

  // 1d. Cross-type same name — funckey and alias share the same key name
  const funckeyKeySet = new Set(funckeyBindings.map((b) => b.key));
  for (const aliasBinding of aliasBindings) {
    if (!aliasBinding.key || !funckeyKeySet.has(aliasBinding.key)) continue;

    const related = bindings.filter((b) => b.key === aliasBinding.key);
    addConflict({
      id: generateConflictId('cross_type_same_name', aliasBinding.key, `"${aliasBinding.key}" 同时定义在 funckey 和 alias 中`),
      type: 'cross_type_same_name',
      subType: 'cross_type_same_name',
      severity: 'warning',
      message: `"${aliasBinding.key}" 同时定义在 funckey 和 alias 中，请确认行为是否符合预期`,
      bindings: related,
      suggestions: ['检查 funckey 和 alias 使用相同键是否符合预期'],
      ignoreable: true,
      involvedKeys: extractInvolvedKeys(related),
      involvedFiles: extractInvolvedFiles(related),
    });
  }

  // ──────────── Step 2: Enhanced Conflict Detection ────────────

  // 2a. same_env_duplicate — same envSourceId, same key, different commands
  const envGroupMap = buildEnvKeyGroupMap(bindings);
  for (const [envId, keyMap] of envGroupMap) {
    for (const [key, group] of keyMap) {
      if (group.length < 2) continue;
      const commands = new Set(group.map((b) => b.command?.trim()).filter(Boolean));
      if (commands.size <= 1) continue;

      addConflict({
        id: generateConflictId('same_env_duplicate', key, `同一 env 文件中按键 "${key}" 存在多条绑定`),
        type: 'funckey_duplicate',
        subType: 'same_env_duplicate',
        severity: 'error',
        message: `同一 env 文件 "${envId}" 中按键 "${key}" 存在 ${group.length} 条绑定，命令不同`,
        bindings: group,
        suggestions: ['编辑或删除其中一条绑定'],
        ignoreable: false,
        involvedKeys: extractInvolvedKeys(group),
        involvedFiles: [envId, ...extractInvolvedFiles(group)],
        envSourceId: envId,
      });
    }
  }

  // 2b. reserved_key_override — user binding hits a reserved binding with warnWhenOverride
  const userBindings = bindings.filter(
    (b) =>
      b.bindingSource === 'user_env_original' ||
      b.bindingSource === 'atm_managed_block' ||
      b.bindingSource === 'active_profile'
  );
  for (const binding of userBindings) {
    if (!binding.key) continue;
    for (const reserved of reservedBindings) {
      if (!reserved.warnWhenOverride || !reserved.key) continue;
      if (binding.key.toLowerCase() !== reserved.key.toLowerCase()) continue;
      if (binding.command?.trim() === reserved.command?.trim()) continue;

      addConflict({
        id: generateConflictId('reserved_key_override', binding.key, `按键 "${binding.key}" 覆盖了保留键`),
        type: 'reserved_key',
        subType: 'reserved_key_override',
        severity: 'warning',
        message: `按键 "${binding.key}" 覆盖了系统保留或软件默认键（${reserved.command}），请谨慎使用`,
        bindings: [binding, reserved],
        suggestions: ['避免覆盖系统/默认快捷键，或确认覆盖行为符合预期'],
        ignoreable: true,
        involvedKeys: [binding.key],
        involvedFiles: [],
        envSourceId: binding.envSourceId,
      });
      break; // one warning per user binding
    }
  }

  // 2c. unrecognized_command — commandSource === 'unknown' and confidence === 'low'
  for (const binding of bindings) {
    let cmdSource = binding.commandSource;
    let conf = binding.confidence;

    // V5.1: 如果 commandSource 未被填充，尝试用 CommandIndex 分类
    if (!cmdSource && params.commandIndex) {
      const classification = params.commandIndex.classifyBinding(binding);
      cmdSource = classification.commandSource;
      conf = classification.confidence || 'low';
    }

    if (cmdSource !== 'unknown' || conf !== 'low') continue;
    if (!binding.key) continue;

    addConflict({
      id: generateConflictId('unrecognized_command', binding.key, `命令 "${binding.command}" 无法识别`),
      type: 'missing_command',
      subType: 'unrecognized_command',
      severity: 'warning',
      message: `按键 "${binding.key}" 的命令 "${binding.command}" 无法识别，可能是拼写错误或未注册的 Skill 命令`,
      bindings: [binding],
      suggestions: getConflictSuggestion('unrecognized_command', binding),
      ignoreable: true,
      involvedKeys: [binding.key],
      involvedFiles: [],
      envSourceId: binding.envSourceId,
    });
  }

  // 2d. skill_not_loaded — loadStatus === 'maybe_unloaded'
  for (const binding of bindings) {
    let loadStatus = binding.loadStatus;
    let skillName = binding.skillName;

    // V5.1: 如果 loadStatus 未被填充，尝试用 CommandIndex 分类
    if (!loadStatus && params.commandIndex) {
      const classification = params.commandIndex.classifyBinding(binding);
      loadStatus = classification.loadStatus as any;
      skillName = classification.skillName;
    }

    if (loadStatus !== 'maybe_unloaded' || !skillName) continue;
    if (!binding.key) continue;

    addConflict({
      id: generateConflictId('skill_not_loaded', binding.key, `Skill "${skillName}" 可能未加载`),
      type: 'skill_unloaded',
      subType: 'skill_not_loaded',
      severity: 'warning',
      message: `命令 "${binding.command}" 所属的 Skill "${skillName}" 可能未加载，快捷键可能无效`,
      bindings: [binding],
      suggestions: getConflictSuggestion('skill_not_loaded', binding),
      ignoreable: true,
      involvedKeys: [binding.key],
      involvedFiles: binding.skillFilePath ? [binding.skillFilePath] : [],
      envSourceId: binding.envSourceId,
    });
  }

  // 2e. cross_env_override — user env vs reference env: same key, different command
  if (referenceEnvBindings.length > 0) {
    const envBindings = bindings.filter(
      (b) => b.bindingSource === 'user_env_original' || b.bindingSource === 'atm_managed_block'
    );
    for (const userB of envBindings) {
      if (!userB.key) continue;
      for (const refB of referenceEnvBindings) {
        if (!refB.key) continue;
        if (userB.key.toLowerCase() !== refB.key.toLowerCase()) continue;
        if (userB.command?.trim() === refB.command?.trim()) continue;

        addConflict({
          id: generateConflictId('cross_env_override', userB.key, `用户 env 覆盖了参考配置的按键 "${userB.key}"`),
          type: 'cross_env_override',
          subType: 'cross_env_override',
          severity: 'info',
          message: `用户 env 中按键 "${userB.key}"（${userB.command}）覆盖了参考配置（${refB.command}）`,
          bindings: [userB, refB],
          suggestions: ['确认用户 env 覆盖参考配置是否符合预期'],
          ignoreable: true,
          involvedKeys: [userB.key],
          involvedFiles: [userB.envSourceId || '', refB.envSourceId || ''].filter(Boolean),
          envSourceId: userB.envSourceId,
        });
        break;
      }
    }
  }

  // 2f. profile_override_env — profile binding vs user env: same key, different command
  if (profileBindings.length > 0) {
    const envBindings = bindings.filter(
      (b) => b.bindingSource === 'user_env_original' || b.bindingSource === 'atm_managed_block'
    );
    for (const profB of profileBindings) {
      if (!profB.key) continue;
      for (const envB of envBindings) {
        if (!envB.key) continue;
        if (profB.key.toLowerCase() !== envB.key.toLowerCase()) continue;
        if (profB.command?.trim() === envB.command?.trim()) continue;

        addConflict({
          id: generateConflictId('profile_override_env', profB.key, `方案绑定的按键 "${profB.key}" 将覆盖用户 env 定义`),
          type: 'cross_env_override',
          subType: 'profile_override_env',
          severity: 'info',
          message: `方案中按键 "${profB.key}"（${profB.command}）将覆盖用户 env 定义（${envB.command}）`,
          bindings: [profB, envB],
          suggestions: ['确认方案覆盖用户 env 定义是否符合预期'],
          ignoreable: true,
          involvedKeys: [profB.key],
          involvedFiles: [],
          envSourceId: profB.envSourceId,
        });
        break;
      }
    }
  }

  // ──────────── Step 3: Build ConflictMatrix ────────────

  return buildConflictMatrix(conflicts);
}

// ─── Conflict Matrix Builder ─────────────────────────────────────────────────

/**
 * Build a ConflictMatrix from a list of EnhancedConflict objects.
 */
function buildConflictMatrix(conflicts: EnhancedConflict[]): ConflictMatrix {
  const byType: Record<string, EnhancedConflict[]> = {};
  const byKey: Record<string, EnhancedConflict[]> = {};
  const errors: EnhancedConflict[] = [];
  const warnings: EnhancedConflict[] = [];
  const infos: EnhancedConflict[] = [];
  const ignoreList: string[] = [];
  const seenIgnoreIds = new Set<string>();

  for (const conflict of conflicts) {
    // byType — group by subType
    const subType = conflict.subType;
    if (!byType[subType]) byType[subType] = [];
    byType[subType].push(conflict);

    // byKey — group by each involved key
    for (const key of conflict.involvedKeys) {
      const primary = resolvePrimaryKeyForGroup(key);
      if (!byKey[primary]) byKey[primary] = [];
      byKey[primary].push(conflict);
    }

    // bySeverity
    switch (conflict.severity) {
      case 'error':
        errors.push(conflict);
        break;
      case 'warning':
        warnings.push(conflict);
        break;
      case 'info':
        infos.push(conflict);
        break;
    }

    // Collect ignorable IDs
    if (conflict.ignoreable && !seenIgnoreIds.has(conflict.id)) {
      seenIgnoreIds.add(conflict.id);
      ignoreList.push(conflict.id);
    }
  }

  return {
    byType,
    bySeverity: { errors, warnings, infos },
    byKey,
    totalCount: conflicts.length,
    ignoreList,
  };
}

/**
 * Resolve a raw key string to a grouping key (uppercase single letter or full name).
 */
function resolvePrimaryKeyForGroup(key: string): string {
  if (key.length === 1 && /[a-zA-Z]/.test(key)) return key.toUpperCase();
  return key;
}

/**
 * Group bindings by their `key` field.
 */
function groupByKey(bindings: HotkeyBinding[]): Map<string, HotkeyBinding[]> {
  const map = new Map<string, HotkeyBinding[]>();
  for (const b of bindings) {
    const k = b.key || '';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  }
  return map;
}

/**
 * Build a nested map: envSourceId -> (key -> HotkeyBinding[])
 */
function buildEnvKeyGroupMap(
  bindings: HotkeyBinding[]
): Map<string, Map<string, HotkeyBinding[]>> {
  const root = new Map<string, Map<string, HotkeyBinding[]>>();
  for (const b of bindings) {
    const envId = b.envSourceId || '__no_env__';
    if (!root.has(envId)) root.set(envId, new Map());
    const keyMap = root.get(envId)!;
    const k = b.key || '';
    if (!keyMap.has(k)) keyMap.set(k, []);
    keyMap.get(k)!.push(b);
  }
  return root;
}

// ─── 5. mergeConflicts ──────────────────────────────────────────────────────

/**
 * Merge existing basic conflicts (from validateHotkeys) with enhanced ones,
 * deduplicating by (type, key, message).
 *
 * @param existing - Conflicts from the basic validator
 * @param enhanced - Conflicts from the enhanced detector
 * @returns A merged list with no duplicates
 */
export function mergeConflicts(existing: Conflict[], enhanced: EnhancedConflict[]): EnhancedConflict[] {
  const seen = new Set<string>();
  const result: EnhancedConflict[] = [];

  // Index enhanced conflict signatures for quick O(1) dedup
  const enhancedSignatures = new Set<string>();
  for (const c of enhanced) {
    for (const b of c.bindings) {
      enhancedSignatures.add(`${c.type}:${b.key || ''}:${c.message}`);
    }
  }

  // Convert existing basic conflicts to EnhancedConflict format,
  // skipping those already covered by enhanced conflicts.
  for (const conflict of existing) {
    const subType = mapBaseTypeToSubType(conflict.type);

    for (const binding of conflict.bindings) {
      const sig = `${conflict.type}:${binding.key || ''}:${conflict.message}`;
      if (seen.has(sig)) continue;
      seen.add(sig);

      // Skip if an enhanced conflict already covers this signature
      if (enhancedSignatures.has(sig)) continue;

      result.push({
        ...conflict,
        id: generateConflictId(subType, binding.key || '', conflict.message),
        subType,
        suggestions: getConflictSuggestion(subType, binding),
        ignoreable: conflict.severity !== 'error',
        involvedKeys: extractInvolvedKeys(conflict.bindings),
        involvedFiles: extractInvolvedFiles(conflict.bindings),
      });
      break; // one merged entry per conflict object
    }
  }

  // Append all enhanced conflicts that were not already in the basic set
  for (const conflict of enhanced) {
    const firstBinding = conflict.bindings[0];
    const sig = `${conflict.type}:${firstBinding?.key || ''}:${conflict.message}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    result.push(conflict);
  }

  return result;
}

// ─── 6. getConflictTypeLabel ─────────────────────────────────────────────────

/**
 * Return a human-readable Chinese label for each conflict subType.
 */
export function getConflictTypeLabel(subType: EnhancedConflict['subType']): string {
  const labels: Record<EnhancedConflict['subType'], string> = {
    same_env_duplicate: '同文件重复',
    reserved_key_override: '保留键覆盖',
    unrecognized_command: '无法识别命令',
    skill_not_loaded: 'Skill未加载',
    cross_env_override: '跨环境覆盖',
    profile_override_env: '方案覆盖',
    funckey_duplicate: 'Funckey重复',
    alias_duplicate: '别名重复',
    alias_prefix: '别名前缀冲突',
    cross_type_same_name: '跨类型同名',
  };
  return labels[subType] || '未知冲突类型';
}

// ─── 7. getConflictSuggestion ────────────────────────────────────────────────

/**
 * Return actionable Chinese suggestion strings for a given conflict subType
 * and optional binding context.
 *
 * @param subType - The conflict sub-type
 * @param binding - Optional binding to provide context-specific suggestions
 * @returns An array of suggestion strings
 */
export function getConflictSuggestion(
  subType: EnhancedConflict['subType'],
  binding?: HotkeyBinding
): string[] {
  const baseSuggestions: Record<EnhancedConflict['subType'], string[]> = {
    same_env_duplicate: ['编辑或删除其中一条绑定'],
    reserved_key_override: ['避免覆盖系统/默认快捷键'],
    unrecognized_command: ['检查命令拼写是否正确', '确认对应的 Skill 已安装并加载', '手动修正命令来源'],
    skill_not_loaded: ['将 Skill 加入加载配置', '检查 Skill 文件是否存在'],
    cross_env_override: ['确认用户 env 覆盖参考配置是否符合预期'],
    profile_override_env: ['确认方案覆盖用户 env 定义是否符合预期'],
    funckey_duplicate: ['编辑或删除其中一条重复绑定'],
    alias_duplicate: ['编辑或删除其中一条重复定义'],
    alias_prefix: ['确认两个别名的前缀关系是否符合预期'],
    cross_type_same_name: ['检查 funckey 和 alias 使用相同键是否符合预期'],
  };

  const suggestions = [...(baseSuggestions[subType] || ['检查配置'])];

  // Augment with binding-specific suggestions
  if (binding) {
    switch (subType) {
      case 'unrecognized_command':
        if (binding.command) {
          suggestions.push(`手动修正命令 "${binding.command}" 的来源`);
        }
        break;
      case 'skill_not_loaded':
        if (binding.skillName) {
          suggestions.push(`在加载配置中添加 load("${binding.skillName}")`);
        }
        break;
      case 'reserved_key_override':
        if (binding.key) {
          suggestions.push(`考虑为按键 "${binding.key}" 更换其他键位`);
        }
        break;
      default:
        break;
    }
  }

  return suggestions;
}
