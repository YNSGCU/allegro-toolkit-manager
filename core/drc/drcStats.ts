/**
 * ATM - DRC 报告聚合统计模块
 * 按类型 / 层 / 网络 / 规则四个维度分组计数。
 */
import type { DrcGroupCount, DrcSummary, DrcViolation } from '../../src/types/drc';

const UNKNOWN = '未知';
const UNCATEGORIZED = '未分类';

/** 空摘要（解析失败 / 空报告时使用） */
export function emptySummary(): DrcSummary {
  return {
    total: 0,
    errors: 0,
    warnings: 0,
    resolved: 0,
    ignored: 0,
    byType: [],
    byLayer: [],
    byNet: [],
    byRule: [],
  };
}

function group(
  violations: DrcViolation[],
  keyOf: (violation: DrcViolation) => string | undefined,
  fallback: string,
): DrcGroupCount[] {
  const counts = new Map<string, number>();
  for (const violation of violations) {
    const key = keyOf(violation) || fallback;
    counts.set(key, (counts.get(key) ?? 0) + violation.count);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 构建报告聚合摘要 */
export function buildSummary(violations: DrcViolation[]): DrcSummary {
  const total = violations.reduce((sum, v) => sum + v.count, 0);
  const errors = violations
    .filter((v) => v.severity === 'error')
    .reduce((sum, v) => sum + v.count, 0);
  const warnings = violations
    .filter((v) => v.severity === 'warning')
    .reduce((sum, v) => sum + v.count, 0);
  const resolved = violations
    .filter((v) => v.status === 'resolved')
    .reduce((sum, v) => sum + v.count, 0);
  const ignored = violations
    .filter((v) => v.status === 'ignored')
    .reduce((sum, v) => sum + v.count, 0);

  return {
    total,
    errors,
    warnings,
    resolved,
    ignored,
    byType: group(violations, (v) => v.constraintType || v.category, UNCATEGORIZED),
    byLayer: group(violations, (v) => v.layer, UNKNOWN),
    byNet: group(violations, (v) => v.net, UNKNOWN),
    byRule: group(violations, (v) => v.rule, UNKNOWN),
  };
}
