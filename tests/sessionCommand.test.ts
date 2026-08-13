/**
 * ATM - Allegro 会话命令执行单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyCommandRisk,
  executeSessionCommand,
} from '../core/session/sessionCommand';

vi.mock('../core/color/vibeColorBridge', () => ({
  executeSkillViaBridge: vi.fn(),
  findBridgeWorkspace: vi.fn(),
}));

import { executeSkillViaBridge, findBridgeWorkspace } from '../core/color/vibeColorBridge';

describe('classifyCommandRisk - 风险分类', () => {
  it('只读命令应分类为 readonly', () => {
    expect(classifyCommandRisk("list(axlVersion('fullVersion) axlCurrentDesign())")).toBe('readonly');
    expect(classifyCommandRisk('axlDBGetDesign()->drcs')).toBe('readonly');
  });

  it('写命令应分类为 write', () => {
    expect(classifyCommandRisk('axlDBDeleteObject(obj)')).toBe('write');
    expect(classifyCommandRisk('axlDBChangeDesign(d)')).toBe('write');
    expect(classifyCommandRisk('outfile("x" "w")')).toBe('write');
  });

  it('关键字大小写不敏感', () => {
    expect(classifyCommandRisk('AXLDBDELETEOBJECT(o)')).toBe('write');
  });
});

describe('executeSessionCommand - 执行', () => {
  beforeEach(() => {
    vi.mocked(findBridgeWorkspace).mockReset();
    vi.mocked(executeSkillViaBridge).mockReset();
  });

  it('workspace 缺失时应返回错误', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue(null);
    const result = await executeSessionCommand('list(1)', 1000);
    expect(result.success).toBe(false);
    expect(result.error).toContain('workspace');
  });

  it('空命令应返回错误', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue('C:/ws');
    const result = await executeSessionCommand('   ', 1000);
    expect(result.success).toBe(false);
    expect(result.error).toContain('不能为空');
  });

  it('超长命令应返回错误', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue('C:/ws');
    const result = await executeSessionCommand('x'.repeat(20001), 1000);
    expect(result.success).toBe(false);
    expect(result.error).toContain('过长');
  });

  it('成功时应返回输出与耗时', async () => {
    vi.mocked(findBridgeWorkspace).mockReturnValue('C:/ws');
    vi.mocked(executeSkillViaBridge).mockResolvedValue({ success: true, output: '17.4' });
    const result = await executeSessionCommand('list(axlVersion)', 1000);
    expect(result.success).toBe(true);
    expect(result.output).toBe('17.4');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
