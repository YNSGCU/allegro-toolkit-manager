/**
 * ATM - Allegro 会话快照探针
 *
 * 通过 Vibe Bridge 执行只读 SKILL，返回当前会话的版本 / 程序名 / 当前设计名 / 设计单位。
 * 只读红线：脚本不调用任何修改设计或环境的 API。
 */
import type { SessionSnapshot } from '../../src/types/session';
import { executeSkillViaBridge, findBridgeWorkspace } from '../color/vibeColorBridge';
import { parseSkillLisp, type LispValue } from '../color/parseSkillLisp';

/** 生成只读会话快照 SKILL（返回 list，由 Bridge 序列化） */
export function buildSessionSnapshotSkill(): string {
  return [
    'let((designName units)',
    'designName = car(errset(axlCurrentDesign() t))',
    'units = car(errset(axlDBGetDesignUnits() t))',
    "list(axlVersion('fullVersion) axlVersion('programName) designName units)",
    ')',
  ].join('\n');
}

function stringAt(value: LispValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** 解析快照输出（executeSkillViaBridge 已剥离 SUCCESS 前缀） */
export function parseSessionSnapshot(output: string): SessionSnapshot {
  let value: LispValue;
  try {
    value = parseSkillLisp(output);
  } catch {
    return { connected: false, message: '会话快照格式无法解析' };
  }
  if (!Array.isArray(value) || value.length < 4) {
    return { connected: false, message: '会话快照字段不完整' };
  }
  return {
    connected: true,
    fullVersion: stringAt(value[0]),
    programName: stringAt(value[1]),
    designName: stringAt(value[2]),
    designUnits: stringAt(value[3]),
  };
}

/** 抓取当前会话快照 */
export async function probeSession(timeoutMs = 10000): Promise<SessionSnapshot> {
  const workspace = findBridgeWorkspace();
  if (!workspace) {
    return { connected: false, message: '未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE。' };
  }
  const result = await executeSkillViaBridge(workspace, buildSessionSnapshotSkill(), timeoutMs);
  if (!result.success || result.output === undefined) {
    return { connected: false, message: result.error || 'Vibe Bridge 未响应。' };
  }
  return parseSessionSnapshot(result.output);
}
