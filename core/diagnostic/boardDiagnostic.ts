/**
 * ATM - 设计体检模块
 *
 * 通过 Vibe Bridge 执行一次批量只读 SKILL 查询，返回当前板子的关键健康指标：
 * 设计名 / 单位 / ETCH 叠层 / 网络数 / 器件数 / DRC 数量。
 *
 * 只读红线：本模块生成的 SKILL 只调用读取 API，不修改设计数据库。
 */
import type { BoardDiagnosticSnapshot } from '../../src/types/diagnostic';
import { executeSkillViaBridge, findBridgeWorkspace } from '../color/vibeColorBridge';
import { parseSkillLisp, type LispValue } from '../color/parseSkillLisp';

/** 生成只读体检 SKILL（无注释，兼容 Bridge 文件模式） */
export function buildBoardDiagnosticSkill(): string {
  return [
    'let((designName units layerNames layerCount netCount compCount drcCount g)',
    'designName = car(errset(axlCurrentDesign() t))',
    'units = car(errset(axlDBGetDesignUnits() t))',
    'layerNames = nil',
    'layerCount = 0',
    'g = axlGetParam("paramLayerGroup:ETCH")',
    'when(g',
    'layerNames = g->groupMembers',
    'layerCount = length(g->groupMembers)',
    ')',
    'netCount = length(car(errset(axlDBGetDesign()->nets t)))',
    'compCount = length(car(errset(axlDBGetDesign()->components t)))',
    'drcCount = length(car(errset(axlDBGetDesign()->drcs t)))',
    'list(designName units layerCount netCount compCount drcCount layerNames)',
    ')',
  ].join('\n');
}

function str(value: LispValue | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: LispValue | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** 解析体检 SKILL 输出 */
export function parseBoardDiagnosticOutput(raw: string): BoardDiagnosticSnapshot {
  let value: LispValue;
  try {
    value = parseSkillLisp(raw);
  } catch {
    return empty('体检结果解析失败');
  }
  if (!Array.isArray(value) || value.length < 7) {
    return empty('体检结果字段不完整');
  }
  const layerNames = Array.isArray(value[6])
    ? value[6].filter((item): item is string => typeof item === 'string')
    : [];
  return {
    connected: true,
    designName: str(value[0]),
    designUnits: str(value[1]),
    layerCount: num(value[2]),
    netCount: num(value[3]),
    componentCount: num(value[4]),
    drcCount: num(value[5]),
    layerNames,
  };
}

function empty(message: string): BoardDiagnosticSnapshot {
  return { connected: false, layerCount: 0, layerNames: [], netCount: 0, componentCount: 0, drcCount: 0, message };
}

/** 运行体检 */
export async function runBoardDiagnostic(timeoutMs = 15000): Promise<BoardDiagnosticSnapshot> {
  const workspace = findBridgeWorkspace();
  if (!workspace) {
    return empty('未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE。');
  }
  const result = await executeSkillViaBridge(workspace, buildBoardDiagnosticSkill(), timeoutMs);
  if (!result.success || result.output === undefined) {
    return empty(result.error || 'Vibe Bridge 未响应。');
  }
  return parseBoardDiagnosticOutput(result.output);
}
