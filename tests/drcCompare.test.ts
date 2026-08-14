import { describe, expect, it } from 'vitest';
import { compareDrcReports } from '../core/drc/drcCompare';
import type { DrcReport, DrcViolation } from '../src/types/drc';

function violation(id: string): DrcViolation {
  return {
    id,
    rule: id,
    description: `desc ${id}`,
    severity: 'error',
    count: 1,
    waived: false,
    fixed: false,
    sourceLine: 0,
    raw: '',
    status: 'unresolved',
  };
}

function report(id: string, name: string, ids: string[]): DrcReport {
  return {
    id,
    name,
    sourceType: 'file',
    format: 'rpt-text',
    importedAt: '2026-08-14T00:00:00.000Z',
    rawHash: 'a'.repeat(64),
    parseWarnings: [],
    summary: {
      total: ids.length,
      errors: ids.length,
      warnings: 0,
      resolved: 0,
      ignored: 0,
      byType: [],
      byLayer: [],
      byNet: [],
      byRule: [],
    },
    violations: ids.map(violation),
  };
}

describe('compareDrcReports', () => {
  it('区分 已解决 / 新增 / 持续 三类差异', () => {
    const a = report('rpt_a', 'A', ['v1', 'v2', 'v3']);
    const b = report('rpt_b', 'B', ['v2', 'v3', 'v4']);
    const r = compareDrcReports(a, b);
    expect(r.summary.resolved).toBe(1);
    expect(r.summary.added).toBe(1);
    expect(r.summary.persistent).toBe(2);
    expect(r.resolved.map((v) => v.id)).toEqual(['v1']);
    expect(r.added.map((v) => v.id)).toEqual(['v4']);
    expect(r.persistent.map((v) => v.id).sort()).toEqual(['v2', 'v3']);
  });

  it('两份完全一致的报告无差异', () => {
    const a = report('rpt_a', 'A', ['v1', 'v2']);
    const b = report('rpt_b', 'B', ['v1', 'v2']);
    const r = compareDrcReports(a, b);
    expect(r.summary.resolved).toBe(0);
    expect(r.summary.added).toBe(0);
    expect(r.summary.persistent).toBe(2);
  });

  it('空报告对比', () => {
    const a = report('rpt_a', 'A', []);
    const b = report('rpt_b', 'B', ['v1']);
    const r = compareDrcReports(a, b);
    expect(r.summary.resolved).toBe(0);
    expect(r.summary.added).toBe(1);
    expect(r.summary.persistent).toBe(0);
  });

  it('报告名与总数正确回填', () => {
    const a = report('rpt_a', 'Baseline', ['v1', 'v2', 'v3']);
    const b = report('rpt_b', 'Current', ['v1']);
    const r = compareDrcReports(a, b);
    expect(r.reportAName).toBe('Baseline');
    expect(r.reportBName).toBe('Current');
    expect(r.summary.totalA).toBe(3);
    expect(r.summary.totalB).toBe(1);
  });
});
