/**
 * ATM - DRC Bridge 在线抓取单元测试
 * 测试场景：
 *   1. SKILL 脚本只读性（不含写 API）
 *   2. 响应解析（SUCCESS + 数据行、引号、nil、waived/fixed）
 *   3. 错误响应容错
 *   4. fetchDrcViaBridge 完整流程（mock 桥接层）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDrcSnapshotSkill,
  parseBridgeDrcResponse,
  fetchDrcViaBridge,
} from '../core/drc/drcBridge';

vi.mock('../core/color/vibeColorBridge', () => ({
  executeSkillViaBridge: vi.fn(),
  findBridgeWorkspace: vi.fn(),
}));

import { executeSkillViaBridge, findBridgeWorkspace } from '../core/color/vibeColorBridge';

const WRITE_APIS = [
  'axlDBChangeDesign',
  'axlDBDeleteObject',
  'axlAddSimpleMove',
  'axlUIWPrint',
  'outfile',
  'write(',
  'axlDBAddProp',
  'axlDBChangeProp',
];

describe('buildDrcSnapshotSkill - 只读红线', () => {
  const skill = buildDrcSnapshotSkill();

  it('应只使用读取 API', () => {
    expect(skill).toContain('axlDBGetDesign');
    expect(skill).toContain('->drcs');
    for (const api of WRITE_APIS) {
      expect(skill).not.toContain(api);
    }
  });

  it('应输出 SUCCESS 头与 R| 数据行', () => {
    expect(skill).toContain('SUCCESS');
    expect(skill).toContain('R|');
    expect(skill).not.toContain(';');
  });
});

describe('parseBridgeDrcResponse - 响应解析', () => {
  it('应解析 SUCCESS 头与字段行', () => {
    const raw = [
      'SUCCESS 2',
      'R|SPMHCS-1|ERROR|0.00|3.00|TOP|VCC|U1|5|1234.56|789.01|nil|nil',
      'R|SPMHGE-16|WARNING|||BOTTOM|GND|R1|2|10.00|20.00|t|nil',
    ].join('\n');
    const { violations, total, warnings } = parseBridgeDrcResponse(raw);
    expect(total).toBe(2);
    expect(warnings).toEqual([]);
    expect(violations).toHaveLength(2);

    const first = violations[0];
    expect(first.rule).toBe('SPMHCS-1');
    expect(first.severity).toBe('error');
    expect(first.layer).toBe('TOP');
    expect(first.net).toBe('VCC');
    expect(first.component).toBe('U1');
    expect(first.pin).toBe('5');
    expect(first.actual).toBe('0.00');
    expect(first.expected).toBe('3.00');
    expect(first.location).toEqual({ x: 1234.56, y: 789.01 });
    expect(first.waived).toBe(false);
    expect(first.fixed).toBe(false);

    const second = violations[1];
    expect(second.severity).toBe('warning');
    expect(second.actual).toBeUndefined();
    expect(second.waived).toBe(true);
    expect(second.location).toEqual({ x: 10, y: 20 });
  });

  it('应容忍 %L 输出的引号包裹', () => {
    const raw = [
      'SUCCESS 1',
      'R|"SPMHCS-1"|"ERROR"|"0"|"3"|"TOP"|nil|nil|nil|nil|nil|nil|nil',
    ].join('\n');
    const { violations } = parseBridgeDrcResponse(raw);
    expect(violations[0].rule).toBe('SPMHCS-1');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].layer).toBe('TOP');
  });

  it('缺少规则码的行应跳过并记录 warning', () => {
    const raw = [
      'SUCCESS 2',
      'R||ERROR|0|3|TOP|VCC|U1|5|1|2|nil|nil',
      'not-a-data-line',
    ].join('\n');
    const { violations, warnings } = parseBridgeDrcResponse(raw);
    expect(violations).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('非 SUCCESS 响应应返回空结果与 warning', () => {
    const { violations, total, warnings } = parseBridgeDrcResponse('ERROR something went wrong');
    expect(violations).toHaveLength(0);
    expect(total).toBe(0);
    expect(warnings).toHaveLength(1);
  });
});

describe('fetchDrcViaBridge - 抓取流程', () => {
  beforeEach(() => {
    vi.mocked(findBridgeWorkspace).mockReset();
    vi.mocked(executeSkillViaBridge).mockReset();
  });

  it('workspace 缺失时应返回未连接', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue(null);
    const result = await fetchDrcViaBridge();
    expect(result.connected).toBe(false);
    expect(result.message).toContain('workspace');
  });

  it('桥接执行失败时应返回未连接与错误信息', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue('C:/bridge/workspace');
    vi.mocked(executeSkillViaBridge).mockResolvedValue({ success: false, error: 'Vibe Bridge 超时' });
    const result = await fetchDrcViaBridge(1000);
    expect(result.connected).toBe(false);
    expect(result.message).toContain('超时');
  });

  it('成功时应返回解析后的报告', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue('C:/bridge/workspace');
    vi.mocked(executeSkillViaBridge).mockResolvedValue({
      success: true,
      output: [
        'SUCCESS 1',
        'R|SPMHCS-1|ERROR|0|3|TOP|VCC|U1|5|1|2|nil|nil',
      ].join('\n'),
    });
    const result = await fetchDrcViaBridge(1000);
    expect(result.connected).toBe(true);
    expect(result.total).toBe(1);
    expect(result.parsed.violations).toHaveLength(1);
    expect(result.parsed.summary.errors).toBe(1);
    expect(result.rawHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.parsed.format).toBe('bridge');
  });
});
