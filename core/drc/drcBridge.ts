/**
 * ATM - DRC Bridge 在线抓取模块
 *
 * 通过 Vibe Bridge（workspace/vibe_in.il + vibe_out.log）在 Allegro 会话中
 * 执行只读 SKILL，遍历 axlDBGetDesign()->drcs 抓取结构化 DRC 数据。
 *
 * 只读红线：本模块生成的 SKILL 只调用读取 API，不修改设计数据库。
 * Vibe Bridge 服务端会给 SKILL 返回值加 `SUCCESS ` 前缀，因此脚本返回纯数据：
 * 首行 count，随后每行 `R|rule|type|actual|expected|layer|net|component|pin|x|y|
 * waived|fixed`（%L 输出，可能带引号或 nil）。
 */
import crypto from 'crypto';
import type { DrcBridgeFetchResult, DrcParsedReport, DrcViolation } from '../../src/types/drc';
import { buildSummary } from './drcStats';
import { normalizeViolation } from './drcNormalizer';
import { executeSkillViaBridge, findBridgeWorkspace } from '../color/vibeColorBridge';

/** 生成只读 DRC 快照 SKILL（无注释，兼容 Bridge 文件模式） */
export function buildDrcSnapshotSkill(): string {
  return [
    'let((design drcs out)',
    'design = axlDBGetDesign()',
    'drcs = design->drcs',
    'out = sprintf(nil "%d\n" length(drcs))',
    'foreach(drc drcs',
    'out = strcat(out sprintf(nil "R|%L|%L|%L|%L|%L|%L|%L|%L|%L|%L|%L|%L\n"',
    'if(drc->?rule drc->rule nil)',
    'if(drc->?type drc->type nil)',
    'if(drc->?actual drc->actual nil)',
    'if(drc->?expected drc->expected nil)',
    'if(drc->?layer drc->layer nil)',
    'if(drc->?net drc->net nil)',
    'if(drc->?component drc->component nil)',
    'if(drc->?pin drc->pin nil)',
    'if(and(drc->?xy drc->xy) car(drc->xy) nil)',
    'if(and(drc->?xy drc->xy) cadr(drc->xy) nil)',
    'if(drc->?waived drc->waived nil)',
    'if(drc->?fixed drc->fixed nil)',
    '))',
    'out',
    ')',
  ].join('\n');
}

/** 去掉 %L 输出的引号 / nil 归一 */
function normalizeCell(cell: string): string | undefined {
  const trimmed = cell.trim();
  if (trimmed === '' || trimmed === 'nil' || trimmed === '()') return undefined;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  return trimmed;
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 解析 Bridge 响应文本 */
export function parseBridgeDrcResponse(raw: string): {
  violations: DrcViolation[];
  total: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    warnings.push('Bridge 响应为空');
    return { violations: [], total: 0, warnings };
  }

  let total = 0;
  let dataStart = 0;
  const successHead = /^SUCCESS\s+(\d+)/i.exec(lines[0]);
  if (successHead) {
    total = Number(successHead[1]);
    dataStart = 1;
  } else if (/^\d+$/.test(lines[0])) {
    total = Number(lines[0]);
    dataStart = 1;
  }
  const violations: DrcViolation[] = [];

  for (const line of lines.slice(dataStart)) {
    if (!line.startsWith('R|')) continue;
    const cells = line.slice(2).split('|').map(normalizeCell);
    if (cells.length < 2) {
      warnings.push('跳过无法解析的 Bridge 数据行');
      continue;
    }
    const [rule, type, actual, expected, layer, net, component, pin, x, y, waived, fixed] = cells;
    if (!rule) {
      warnings.push('跳过缺少规则码的 Bridge 数据行');
      continue;
    }
    const severity: DrcViolation['severity'] =
      type && /warn/i.test(type) ? 'warning' : 'error';
    const xNum = toNumber(x);
    const yNum = toNumber(y);
    const violation = normalizeViolation({
      rule,
      severity,
      description: '',
      actual,
      expected,
      layer,
      net,
      component,
      pin,
      location: xNum !== undefined && yNum !== undefined ? { x: xNum, y: yNum } : undefined,
      waived: waived === 't' || waived === 'true' || waived === '1',
      fixed: fixed === 't' || fixed === 'true' || fixed === '1',
    });
    violations.push(violation);
  }

  if (violations.length === 0) {
    warnings.push('未解析到有效的 DRC 数据行');
  }

  return { violations, total, warnings };
}

/** 通过 Vibe Bridge 抓取当前会话的 DRC 数据 */
export async function fetchDrcViaBridge(timeoutMs = 20000): Promise<DrcBridgeFetchResult> {
  const workspace = findBridgeWorkspace();
  if (!workspace) {
    return {
      connected: false,
      total: 0,
      rawHash: '',
      rawText: '',
      parsed: {
        format: 'bridge',
        name: 'DRC 报告（Bridge）',
        parseWarnings: ['未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE。'],
        summary: buildSummary([]),
        violations: [],
      },
      message: '未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE。',
    };
  }

  const result = await executeSkillViaBridge(workspace, buildDrcSnapshotSkill(), timeoutMs);
  if (!result.success || result.output === undefined) {
    return {
      connected: false,
      total: 0,
      rawHash: '',
      rawText: '',
      parsed: {
        format: 'bridge',
        name: 'DRC 报告（Bridge）',
        parseWarnings: [result.error ?? 'Vibe Bridge 未响应。'],
        summary: buildSummary([]),
        violations: [],
      },
      message: result.error ?? 'Vibe Bridge 未响应。',
    };
  }

  const rawText = result.output;
  const { violations, total, warnings } = parseBridgeDrcResponse(rawText);
  const parsed: DrcParsedReport = {
    format: 'bridge',
    name: `DRC 报告（${violations.length} 条）`,
    parseWarnings: warnings,
    summary: buildSummary(violations),
    violations,
  };
  return {
    connected: true,
    total,
    rawHash: crypto.createHash('sha256').update(rawText, 'utf-8').digest('hex'),
    rawText,
    parsed,
  };
}
