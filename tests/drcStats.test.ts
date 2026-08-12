/**
 * ATM - DRC 报告聚合统计单元测试
 */
import { describe, it, expect } from 'vitest';
import { buildSummary, emptySummary } from '../core/drc/drcStats';
import { normalizeViolation } from '../core/drc/drcNormalizer';
import type { DrcViolation } from '../src/types/drc';

function makeViolation(
  partial: Partial<DrcViolation> & { rule: string; severity: DrcViolation['severity'] },
): DrcViolation {
  return normalizeViolation(partial);
}

describe('emptySummary', () => {
  it('应返回全零空摘要', () => {
    const summary = emptySummary();
    expect(summary.total).toBe(0);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(0);
    expect(summary.resolved).toBe(0);
    expect(summary.ignored).toBe(0);
    expect(summary.byType).toEqual([]);
    expect(summary.byLayer).toEqual([]);
    expect(summary.byNet).toEqual([]);
    expect(summary.byRule).toEqual([]);
  });
});

describe('buildSummary - 聚合统计', () => {
  it('空数组应返回全零', () => {
    const summary = buildSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.errors).toBe(0);
  });

  it('应统计总数 / 错误 / 警告', () => {
    const violations = [
      makeViolation({ rule: 'SPMHCS-1', severity: 'error' }),
      makeViolation({ rule: 'SPMHGE-16', severity: 'warning' }),
      makeViolation({ rule: 'SPMHCS-1', severity: 'error' }),
    ];
    const summary = buildSummary(violations);
    expect(summary.total).toBe(3);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
  });

  it('应统计已解决与已忽略', () => {
    const violations = [
      makeViolation({ rule: 'A', severity: 'error', status: 'resolved' }),
      makeViolation({ rule: 'B', severity: 'warning', status: 'ignored' }),
      makeViolation({ rule: 'C', severity: 'error' }),
    ];
    const summary = buildSummary(violations);
    expect(summary.resolved).toBe(1);
    expect(summary.ignored).toBe(1);
  });

  it('应按规则 / 层 / 网络 / 类型分组并降序排序', () => {
    const violations = [
      makeViolation({ rule: 'SPMHCS-1', severity: 'error', layer: 'TOP', net: 'VCC', constraintType: 'SolderMask' }),
      makeViolation({ rule: 'SPMHCS-1', severity: 'error', layer: 'TOP', net: 'GND', constraintType: 'SolderMask' }),
      makeViolation({ rule: 'SPMHGE-16', severity: 'warning', layer: 'BOTTOM', net: 'GND', constraintType: 'ThermalRelief' }),
    ];
    const summary = buildSummary(violations);
    expect(summary.byRule).toEqual([
      { name: 'SPMHCS-1', count: 2 },
      { name: 'SPMHGE-16', count: 1 },
    ]);
    expect(summary.byLayer.find((g) => g.name === 'TOP')?.count).toBe(2);
    expect(summary.byNet.find((g) => g.name === 'GND')?.count).toBe(2);
    expect(summary.byType.find((g) => g.name === 'SolderMask')?.count).toBe(2);
    expect(summary.byType.find((g) => g.name === 'ThermalRelief')?.count).toBe(1);
  });

  it('缺失维度应归入未知 / 未分类', () => {
    const violations = [
      makeViolation({ rule: 'SPMHCS-1', severity: 'error' }),
      makeViolation({ rule: 'SPMHCS-2', severity: 'error', category: 'Spacing' }),
    ];
    const summary = buildSummary(violations);
    expect(summary.byLayer.find((g) => g.name === '未知')?.count).toBe(2);
    expect(summary.byNet.find((g) => g.name === '未知')?.count).toBe(2);
    expect(summary.byType.find((g) => g.name === '未分类')?.count).toBe(1);
    expect(summary.byType.find((g) => g.name === 'Spacing')?.count).toBe(1);
  });

  it('count 应参与统计（合并后的聚合数量）', () => {
    const violations = [
      makeViolation({ rule: 'SPMHCS-1', severity: 'error', layer: 'TOP', net: 'VCC' }),
    ];
    violations[0].count = 5;
    const summary = buildSummary(violations);
    expect(summary.total).toBe(5);
    expect(summary.byRule.find((g) => g.name === 'SPMHCS-1')?.count).toBe(5);
    expect(summary.byLayer.find((g) => g.name === 'TOP')?.count).toBe(5);
    expect(summary.byNet.find((g) => g.name === 'VCC')?.count).toBe(5);
  });
});
