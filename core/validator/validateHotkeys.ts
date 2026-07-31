/**
 * ATM - 快捷键冲突检测模块
 * 检测 funckey 和 alias 之间的冲突
 * 规则：
 *   - funckey：只检测完全相同按键重复
 *   - alias：检测完全相同别名重复，前缀关系仅低风险提示
 *   - 跨类型同名：黄色提示
 *   - 空命令：红色错误
 *   - 系统保留键：黄色警告
 */
import { isReservedKey } from '../parser/parseFunckey';
import type { EnvEntry, HotkeyBinding, Conflict, ValidationResult } from '../../src/types/hotkey';

/**
 * 检测快捷键冲突
 * @param entries env 解析条目列表
 * @returns ValidationResult
 */
export function validateHotkeys(entries: EnvEntry[]): ValidationResult {
  const conflicts: Conflict[] = [];
  const bindings: HotkeyBinding[] = [];
  let idCounter = 0;

  // Step 1: 提取所有 funckey 和 alias 条目
  const funckeyEntries: EnvEntry[] = [];
  const aliasEntries: EnvEntry[] = [];

  for (const entry of entries) {
    if (entry.type === 'funckey' && entry.key) {
      funckeyEntries.push(entry);
    } else if (entry.type === 'alias' && entry.key) {
      aliasEntries.push(entry);
    }
  }

  // Step 2: 构建 HotkeyBinding 列表，同时检测空命令和保留键
  const allBindings: HotkeyBinding[] = [];

  for (const entry of [...funckeyEntries, ...aliasEntries]) {
    // entry.type 已被 filter 约束为 "funckey" | "alias"
    const entryType = entry.type as 'funckey' | 'alias';
    idCounter++;
    const binding: HotkeyBinding = {
      id: `binding_${idCounter}`,
      key: entry.key!,
      command: entry.command || '',
      type: entryType,
      bindingSource: entry.source === 'atm_managed' ? 'atm_managed_block' : 'user_env_original',
      status: 'normal',
      lineNumber: entry.lineNumber,
      notes: [],
    };

    // 检测空命令
    if (!entry.command || entry.command.trim() === '') {
      binding.status = 'missing_command';
      binding.notes?.push('命令为空');
    }

    // 检测系统保留键
    if (entry.key && isReservedKey(entry.key)) {
      binding.status = binding.status === 'normal' ? 'reserved' : binding.status;
      binding.notes?.push(`系统保留键: ${entry.key}`);
    }

    allBindings.push(binding);
  }

  // Step 3: 检测 funckey 完全相同按键重复
  const funckeyByKey = groupByKey(funckeyEntries);
  for (const [key, entries] of funckeyByKey) {
    if (entries.length >= 2) {
      // 检查是否有不同的 command
      const commands = new Set(entries.map((e) => e.command?.trim()));
      if (commands.size > 1 || (commands.size === 1 && [...commands][0] === '')) {
        // 完全相同按键 + 不同命令 = 冲突
        const relatedBindings = allBindings.filter(
          (b) => b.type === 'funckey' && b.key === key
        );
        relatedBindings.forEach((b) => {
          b.status = 'duplicate';
          b.notes?.push(`按键 "${key}" 存在多个绑定`);
        });

        conflicts.push({
          type: 'funckey_duplicate',
          severity: 'error',
          message: `funckey 按键 "${key}" 存在 ${entries.length} 个绑定，命令不同`,
          bindings: relatedBindings,
        });
      }
    }
  }

  // Step 4: 检测 alias 完全相同别名重复
  const aliasByKey = groupByKey(aliasEntries);
  for (const [key, entries] of aliasByKey) {
    if (entries.length >= 2) {
      const commands = new Set(entries.map((e) => e.command?.trim()));
      if (commands.size > 1 || (commands.size === 1 && [...commands][0] === '')) {
        const relatedBindings = allBindings.filter(
          (b) => b.type === 'alias' && b.key === key
        );
        relatedBindings.forEach((b) => {
          b.status = 'duplicate';
          b.notes?.push(`别名 "${key}" 存在多个定义`);
        });

        conflicts.push({
          type: 'alias_duplicate',
          severity: 'error',
          message: `alias "${key}" 存在 ${entries.length} 个定义，命令不同`,
          bindings: relatedBindings,
        });
      }
    }
  }

  // Step 5: 检测 alias 前缀关系（仅低风险提示）
  const aliasKeys = aliasEntries.map((e) => e.key!).filter(Boolean);
  for (let i = 0; i < aliasKeys.length; i++) {
    for (let j = 0; j < aliasKeys.length; j++) {
      if (i === j) continue;
      const shortKey = aliasKeys[i];
      const longKey = aliasKeys[j];
      // 检查是否是前缀关系（较短的 key 是较长 key 的前缀）
      if (longKey.startsWith(shortKey) && longKey !== shortKey) {
        const alreadyReported = conflicts.some(
          (c) =>
            c.type === 'alias_prefix' &&
            c.message.includes(shortKey) &&
            c.message.includes(longKey)
        );
        if (!alreadyReported) {
          const shortBinding = allBindings.find(
            (b) => b.type === 'alias' && b.key === shortKey
          );
          const longBinding = allBindings.find(
            (b) => b.type === 'alias' && b.key === longKey
          );
          const related: HotkeyBinding[] = [];
          if (shortBinding) {
            shortBinding.status = shortBinding.status === 'normal' ? 'prefix_conflict' : shortBinding.status;
            shortBinding.notes?.push(`别名 "${shortKey}" 是 "${longKey}" 的前缀`);
            related.push(shortBinding);
          }
          if (longBinding) {
            longBinding.status = longBinding.status === 'normal' ? 'prefix_conflict' : longBinding.status;
            longBinding.notes?.push(`别名 "${longKey}" 以 "${shortKey}" 为前缀`);
            related.push(longBinding);
          }

          conflicts.push({
            type: 'alias_prefix',
            severity: 'warning',
            message: `alias 前缀关系: "${shortKey}" 是 "${longKey}" 的前缀`,
            bindings: related,
          });
        }
      }
    }
  }

  // Step 6: 检测跨类型同名（funckey 和 alias 使用相同 key）
  const funckeyKeys = new Set(funckeyEntries.map((e) => e.key));
  const aliasKeysSet = new Set(aliasEntries.map((e) => e.key));

  for (const key of funckeyKeys) {
    if (key && aliasKeysSet.has(key)) {
      const relatedBindings = allBindings.filter((b) => b.key === key);
      relatedBindings.forEach((b) => {
        if (b.status === 'normal') {
          b.status = 'prefix_conflict';
        }
        b.notes?.push(`同名 "${key}" 同时出现在 funckey 和 alias 中`);
      });

      conflicts.push({
        type: 'cross_type_same_name',
        severity: 'warning',
        message: `"${key}" 同时定义在 funckey 和 alias 中，请确认行为是否符合预期`,
        bindings: relatedBindings,
      });
    }
  }

  // Step 7: 统计
  const stats = {
    total: allBindings.length,
    funckeyCount: funckeyEntries.length,
    aliasCount: aliasEntries.length,
    errorCount: conflicts.filter((c) => c.severity === 'error').length,
    warningCount: conflicts.filter((c) => c.severity === 'warning').length,
  };

  return {
    conflicts,
    bindings: allBindings,
    stats,
  };
}

/**
 * 按 key 对条目进行分组
 */
function groupByKey(entries: EnvEntry[]): Map<string, EnvEntry[]> {
  const map = new Map<string, EnvEntry[]>();
  for (const entry of entries) {
    const key = entry.key || '';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(entry);
  }
  return map;
}

// ═══════════════════════════════════════════════════
// V5.1 绑定富化
// ═══════════════════════════════════════════════════

/**
 * 富化 HotkeyBinding 列表：用 CommandIndex 填充 commandSource/skillName/skillFilePath/loadStatus 等字段
 * @param bindings 原始绑定列表
 * @param commandIndex 命令索引
 * @returns 富化后的绑定列表
 */
export function enrichBindings(
  bindings: HotkeyBinding[],
  commandIndex: any, // CommandIndex 类型，避免跨层 import
): HotkeyBinding[] {
  if (!commandIndex || typeof commandIndex.classifyBinding !== 'function') return bindings;
  return bindings.map((b) => ({
    ...b,
    ...commandIndex.classifyBinding(b),
  }));
}
