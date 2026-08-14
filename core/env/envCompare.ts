/**
 * ATM - Env 来源对比
 *
 * 比较两份 env 文档的可编辑条目（funckey / alias / variable），
 * 产出「仅在 A / 仅在 B / 值不同」三类差异。重复 key 保留后定义值
 * （Allegro 后定义覆盖先定义）。
 */
import type {
  EnvCompareDiff,
  EnvCompareResult,
  EnvCompareType,
  EnvEditorEntry,
} from '../../src/types/envEditor';

const COMPARABLE_TYPES: EnvCompareType[] = ['funckey', 'alias', 'variable'];

interface EntryValue {
  type: EnvCompareType;
  value: string;
}

/** 提取可比较的键值对，复合键为 `type:key`（不同类型同名 key 互不影响） */
function extractMap(entries: EnvEditorEntry[]): Map<string, EntryValue> {
  const map = new Map<string, EntryValue>();
  for (const entry of entries) {
    const type = entry.type as EnvCompareType;
    if (!COMPARABLE_TYPES.includes(type)) continue;
    if (!entry.key) continue;
    map.set(`${type}:${entry.key}`, { type, value: entry.value ?? '' });
  }
  return map;
}

export function compareEnvDocuments(
  a: EnvEditorEntry[],
  b: EnvEditorEntry[],
  options?: { aLabel?: string; aPath?: string; bLabel?: string; bPath?: string },
): EnvCompareResult {
  const mapA = extractMap(a);
  const mapB = extractMap(b);
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  const diffs: EnvCompareDiff[] = [];

  for (const composite of [...keys].sort()) {
    const aEntry = mapA.get(composite);
    const bEntry = mapB.get(composite);
    const type = (aEntry ?? bEntry)!.type;
    const key = composite.slice(composite.indexOf(':') + 1);

    if (aEntry && bEntry) {
      if (aEntry.value !== bEntry.value) {
        diffs.push({ type, key, aValue: aEntry.value, bValue: bEntry.value, status: 'different' });
      }
    } else if (aEntry) {
      diffs.push({ type, key, aValue: aEntry.value, status: 'only_a' });
    } else {
      diffs.push({ type, key, bValue: bEntry!.value, status: 'only_b' });
    }
  }

  const count = (status: EnvCompareDiff['status']): number =>
    diffs.filter((d) => d.status === status).length;

  return {
    aLabel: options?.aLabel ?? '用户 env',
    aPath: options?.aPath ?? '',
    bLabel: options?.bLabel ?? '参考 env',
    bPath: options?.bPath ?? '',
    diffs,
    summary: {
      onlyA: count('only_a'),
      onlyB: count('only_b'),
      different: count('different'),
      total: diffs.length,
    },
  };
}
