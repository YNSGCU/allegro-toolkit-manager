/**
 * ATM - DRC 违规归一化单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeRule,
  normalizeLayer,
  normalizeOptional,
  parseLocation,
  makeViolationId,
  normalizeViolation,
  mergeViolations,
} from '../core/drc/drcNormalizer';

describe('normalizeRule / normalizeLayer / normalizeOptional', () => {
  it('规则码应 trim、压缩空白并大写', () => {
    expect(normalizeRule('  spmhcs-1 ')).toBe('SPMHCS-1');
    expect(normalizeRule('SPMH GE-16')).toBe('SPMH GE-16');
    expect(normalizeRule(undefined)).toBe('未知规则');
  });

  it('层名全小写应转大写，混合写法保留', () => {
    expect(normalizeLayer('top')).toBe('TOP');
    expect(normalizeLayer('bottom')).toBe('BOTTOM');
    expect(normalizeLayer('TOP')).toBe('TOP');
    expect(normalizeLayer('Top')).toBe('Top');
    expect(normalizeLayer(undefined)).toBeUndefined();
  });

  it('可选字符串应 trim 并压缩空白，空串转 undefined', () => {
    expect(normalizeOptional('  a  b ')).toBe('a b');
    expect(normalizeOptional('   ')).toBeUndefined();
    expect(normalizeOptional('')).toBeUndefined();
    expect(normalizeOptional(null)).toBeUndefined();
  });
});

describe('parseLocation - 坐标解析', () => {
  it('应解析括号坐标并附带单位', () => {
    expect(parseLocation('(1234.56 789.01)', 'Mils')).toEqual({
      x: 1234.56,
      y: 789.01,
      units: 'Mils',
    });
  });

  it('应支持方括号与逗号分隔', () => {
    expect(parseLocation('[1, 2]')).toEqual({ x: 1, y: 2, units: undefined });
  });

  it('非法坐标应返回 undefined', () => {
    expect(parseLocation('invalid')).toBeUndefined();
    expect(parseLocation(undefined)).toBeUndefined();
    expect(parseLocation('(a b)')).toBeUndefined();
  });
});

describe('makeViolationId - 稳定 id', () => {
  it('相同输入应产生相同 id', () => {
    const a = makeViolationId('SPMHCS-1', 'TOP', 'VCC', { x: 1, y: 2 });
    const b = makeViolationId('SPMHCS-1', 'TOP', 'VCC', { x: 1, y: 2 });
    expect(a).toBe(b);
  });

  it('不同输入应产生不同 id', () => {
    const a = makeViolationId('SPMHCS-1', 'TOP', 'VCC', { x: 1, y: 2 });
    const b = makeViolationId('SPMHCS-1', 'TOP', 'VCC', { x: 3, y: 4 });
    const c = makeViolationId('SPMHCS-2', 'TOP', 'VCC', { x: 1, y: 2 });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('normalizeViolation - 默认值与补全', () => {
  it('应补全默认字段', () => {
    const v = normalizeViolation({ rule: 'spmhcs-1', severity: 'error' });
    expect(v.id).toMatch(/^drc_[0-9a-f]+$/);
    expect(v.rule).toBe('SPMHCS-1');
    expect(v.severity).toBe('error');
    expect(v.count).toBe(1);
    expect(v.waived).toBe(false);
    expect(v.fixed).toBe(false);
    expect(v.status).toBe('unresolved');
    expect(v.sourceLine).toBe(0);
  });

  it('应保留传入字段并修正严重级别', () => {
    const v = normalizeViolation({
      rule: 'SPMHGE-16',
      severity: 'warning',
      layer: 'top',
      category: 'thermal',
      sourceLine: 7,
      raw: '#7 WARNING(SPMHGE-16): test',
    });
    expect(v.layer).toBe('TOP');
    expect(v.severity).toBe('warning');
    expect(v.sourceLine).toBe(7);
  });
});

describe('mergeViolations - 去重合并', () => {
  it('同 id 应合并 count，不同 id 保留', () => {
    const a = normalizeViolation({ rule: 'SPMHCS-1', severity: 'error', layer: 'TOP', net: 'VCC' });
    const b = normalizeViolation({ rule: 'SPMHCS-1', severity: 'error', layer: 'TOP', net: 'VCC' });
    const c = normalizeViolation({ rule: 'SPMHCS-1', severity: 'error', layer: 'BOTTOM', net: 'VCC' });
    const merged = mergeViolations([a, b, c]);
    expect(merged).toHaveLength(2);
    const top = merged.find((v) => v.layer === 'TOP');
    expect(top!.count).toBe(2);
  });
});
