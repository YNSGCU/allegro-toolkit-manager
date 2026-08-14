import { describe, expect, it } from 'vitest';
import { compareEnvDocuments } from '../core/env/envCompare';
import type { EnvEditorEntry } from '../src/types/envEditor';

function entry(type: EnvEditorEntry['type'], key: string, value: string, lineNumber = 1): EnvEditorEntry {
  return {
    id: `line_${lineNumber}`,
    type,
    key,
    value,
    raw: `${type} ${key} ${value}`.trim(),
    lineNumber,
    source: 'user_original',
    dirty: false,
    deleted: false,
  };
}

describe('compareEnvDocuments', () => {
  it('完全一致时无差异', () => {
    const a = [entry('funckey', 'F1', 'zoom fit'), entry('alias', 'zc', 'zoom center')];
    const b = [entry('funckey', 'F1', 'zoom fit'), entry('alias', 'zc', 'zoom center')];
    const result = compareEnvDocuments(a, b);
    expect(result.diffs).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it('区分 仅在 A / 仅在 B / 值不同 三类差异', () => {
    const a = [
      entry('funckey', 'F1', 'zoom fit'),
      entry('alias', 'zc', 'zoom center'),
      entry('variable', 'CDS_SITE', '/site'),
    ];
    const b = [
      entry('funckey', 'F1', 'zoom fit'),
      entry('alias', 'zc', 'zoom out'),
      entry('variable', 'HOME', '/home'),
    ];
    const result = compareEnvDocuments(a, b);
    expect(result.summary.onlyA).toBe(1);
    expect(result.summary.onlyB).toBe(1);
    expect(result.summary.different).toBe(1);
    expect(result.summary.total).toBe(3);

    expect(result.diffs.find((d) => d.status === 'only_a')?.key).toBe('CDS_SITE');
    expect(result.diffs.find((d) => d.status === 'only_b')?.key).toBe('HOME');
    const diff = result.diffs.find((d) => d.status === 'different');
    expect(diff?.key).toBe('zc');
    expect(diff?.aValue).toBe('zoom center');
    expect(diff?.bValue).toBe('zoom out');
  });

  it('忽略 comment/blank/raw 等非可编辑类型', () => {
    const a = [
      entry('comment', '', '# hello', 1),
      entry('blank', '', '', 2),
      entry('raw', '', 'unknown line', 3),
      entry('funckey', 'F1', 'zoom fit', 4),
    ];
    const b = [entry('funckey', 'F1', 'zoom fit')];
    const result = compareEnvDocuments(a, b);
    expect(result.diffs).toHaveLength(0);
  });

  it('不同类型同名 key 视为不同条目', () => {
    const a = [entry('funckey', 'F1', 'a')];
    const b = [entry('variable', 'F1', 'b')];
    const result = compareEnvDocuments(a, b);
    expect(result.summary.onlyA).toBe(1);
    expect(result.summary.onlyB).toBe(1);
  });

  it('重复 key 保留后定义值', () => {
    const a = [entry('funckey', 'F1', 'first', 1), entry('funckey', 'F1', 'second', 2)];
    const b = [entry('funckey', 'F1', 'second')];
    const result = compareEnvDocuments(a, b);
    expect(result.diffs).toHaveLength(0);
  });
});
