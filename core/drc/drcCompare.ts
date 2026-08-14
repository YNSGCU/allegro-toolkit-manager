/**
 * ATM - DRC 多报告横向对比
 *
 * 按稳定 id（rule|layer|net|xy 哈希）匹配两份报告的违规，
 * 产出「已解决（A 有 B 无）/ 新增（B 有 A 无）/ 持续（两者都有）」。
 */
import type { DrcCompareResult, DrcReport } from '../../src/types/drc';

export function compareDrcReports(a: DrcReport, b: DrcReport): DrcCompareResult {
  const idsA = new Set(a.violations.map((v) => v.id));
  const idsB = new Set(b.violations.map((v) => v.id));

  const resolved = a.violations.filter((v) => !idsB.has(v.id));
  const added = b.violations.filter((v) => !idsA.has(v.id));
  const persistent = b.violations.filter((v) => idsA.has(v.id));

  return {
    reportAId: a.id,
    reportAName: a.name,
    reportBId: b.id,
    reportBName: b.name,
    resolved,
    added,
    persistent,
    summary: {
      resolved: resolved.length,
      added: added.length,
      persistent: persistent.length,
      totalA: a.violations.length,
      totalB: b.violations.length,
    },
  };
}
