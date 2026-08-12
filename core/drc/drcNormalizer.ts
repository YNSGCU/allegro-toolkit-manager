/**
 * ATM - DRC 违规归一化模块
 * 规范化规则码 / 层名，生成稳定 id，并支持同 id 去重合并。
 */
import type { DrcLocation, DrcViolation } from '../../src/types/drc';

/** 层名大小写归一：全小写的单层名转大写（top -> TOP），保留混合写法 */
export function normalizeLayer(layer: string | undefined): string | undefined {
  const value = normalizeOptional(layer);
  if (value === undefined) return undefined;
  if (value === value.toLowerCase()) return value.toUpperCase();
  return value;
}

/** 可选字符串规范化：trim、压缩空白、空串转 undefined */
export function normalizeOptional(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed.replace(/\s+/g, ' ');
}

/** 规则码规范化：trim + 压缩空白 + 大写 */
export function normalizeRule(rule: string | undefined): string {
  return (normalizeOptional(rule) ?? '未知规则').toUpperCase();
}

/** 坐标字符串 "(x y)" 解析；失败返回 undefined */
export function parseLocation(
  raw: string | undefined,
  units?: string,
): DrcLocation | undefined {
  if (!raw) return undefined;
  const inner = raw.trim().replace(/^[(\[]/, '').replace(/[)\]]$/, '').trim();
  const tokens = inner.split(/[\s,]+/).filter(Boolean);
  const x = Number(tokens[0]);
  const y = Number(tokens[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y, units };
}

/** 从 rule/layer/net/xy 生成稳定 id（djb2 哈希） */
export function makeViolationId(
  rule: string,
  layer?: string,
  net?: string,
  location?: DrcLocation,
): string {
  const key = [
    normalizeRule(rule),
    normalizeLayer(layer) ?? '',
    normalizeOptional(net) ?? '',
    location ? `${location.x},${location.y}` : '',
  ].join('|');
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }
  return `drc_${hash.toString(16)}`;
}

/** 将解析器产出的部分违规对象补全为完整 DrcViolation */
export function normalizeViolation(
  input: Partial<DrcViolation> & {
    rule: string;
    severity: DrcViolation['severity'];
  },
  units?: string,
): DrcViolation {
  const rule = normalizeRule(input.rule);
  const layer = normalizeLayer(input.layer);
  const net = normalizeOptional(input.net);
  const component = normalizeOptional(input.component);
  const pin = normalizeOptional(input.pin);
  const description = normalizeOptional(input.description) ?? '';
  const location = input.location;
  return {
    id: makeViolationId(rule, layer, net, location),
    rule,
    description,
    severity: input.severity === 'warning' ? 'warning' : 'error',
    category: normalizeOptional(input.category),
    constraintType: normalizeOptional(input.constraintType),
    actual: normalizeOptional(input.actual),
    expected: normalizeOptional(input.expected),
    layer,
    net,
    component,
    pin,
    location,
    count: input.count ?? 1,
    waived: !!input.waived,
    fixed: !!input.fixed,
    sourceLine: input.sourceLine ?? 0,
    raw: input.raw ?? '',
    status: input.status ?? 'unresolved',
  };
}

/** 同 id 违规去重合并（count 累加，保留首条信息） */
export function mergeViolations(violations: DrcViolation[]): DrcViolation[] {
  const byId = new Map<string, DrcViolation>();
  for (const violation of violations) {
    const existing = byId.get(violation.id);
    if (existing) {
      existing.count += violation.count;
    } else {
      byId.set(violation.id, { ...violation });
    }
  }
  return [...byId.values()];
}
