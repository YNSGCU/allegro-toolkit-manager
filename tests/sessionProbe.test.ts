/**
 * ATM - Allegro 会话快照探针单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSessionSnapshotSkill,
  parseSessionSnapshot,
  probeSession,
} from '../core/session/sessionProbe';

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
  'axlDBDefineAlias',
];

describe('buildSessionSnapshotSkill - 只读红线', () => {
  const skill = buildSessionSnapshotSkill();

  it('应只使用读取 API', () => {
    expect(skill).toContain('axlVersion');
    expect(skill).toContain('axlCurrentDesign');
    expect(skill).toContain('axlDBGetDesignUnits');
    for (const api of WRITE_APIS) {
      expect(skill).not.toContain(api);
    }
    expect(skill).not.toContain(';');
  });
});

describe('parseSessionSnapshot - 快照解析', () => {
  it('应解析版本 / 程序名 / 设计名 / 单位', () => {
    const snapshot = parseSessionSnapshot('("17.4-2019 S039" "allegro" "demo.brd" "mils")');
    expect(snapshot.connected).toBe(true);
    expect(snapshot.fullVersion).toBe('17.4-2019 S039');
    expect(snapshot.programName).toBe('allegro');
    expect(snapshot.designName).toBe('demo.brd');
    expect(snapshot.designUnits).toBe('mils');
  });

  it('未打开设计时 designName 应为 undefined', () => {
    const snapshot = parseSessionSnapshot('("17.4-2019 S039" "allegro" nil "mils")');
    expect(snapshot.connected).toBe(true);
    expect(snapshot.designName).toBeUndefined();
    expect(snapshot.designUnits).toBe('mils');
  });

  it('无法解析时应返回未连接与提示', () => {
    const snapshot = parseSessionSnapshot('not a lisp value');
    expect(snapshot.connected).toBe(false);
    expect(snapshot.message).toBeTruthy();
  });

  it('字段不足时应返回未连接', () => {
    const snapshot = parseSessionSnapshot('("17.4" "allegro")');
    expect(snapshot.connected).toBe(false);
  });
});

describe('probeSession - 抓取流程', () => {
  beforeEach(() => {
    vi.mocked(findBridgeWorkspace).mockReset();
    vi.mocked(executeSkillViaBridge).mockReset();
  });

  it('workspace 缺失时应返回未连接', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue(null);
    const snapshot = await probeSession(1000);
    expect(snapshot.connected).toBe(false);
    expect(snapshot.message).toContain('workspace');
  });

  it('执行失败时应返回错误信息', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue('C:/bridge/workspace');
    vi.mocked(executeSkillViaBridge).mockResolvedValue({ success: false, error: 'Vibe Bridge 超时' });
    const snapshot = await probeSession(1000);
    expect(snapshot.connected).toBe(false);
    expect(snapshot.message).toContain('超时');
  });

  it('成功时应返回会话快照', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue('C:/bridge/workspace');
    vi.mocked(executeSkillViaBridge).mockResolvedValue({
      success: true,
      output: '("17.4-2019 S039" "allegro" "demo.brd" "mils")',
    });
    const snapshot = await probeSession(1000);
    expect(snapshot.connected).toBe(true);
    expect(snapshot.designName).toBe('demo.brd');
    expect(snapshot.designUnits).toBe('mils');
  });
});
