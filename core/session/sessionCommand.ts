/**
 * ATM - Allegro 会话命令执行模块
 *
 * 复用 executeSkillViaBridge 执行 SKILL 代码，并做只读/写风险分类：
 * 写命令需在 UI 层二次确认。
 */
import type { SessionCommandResult, SessionCommandRisk } from '../../src/types/session';
import { executeSkillViaBridge, findBridgeWorkspace } from '../color/vibeColorBridge';

const WRITE_APIS = [
  'axlDBChangeDesign',
  'axlDBDeleteObject',
  'axlDeleteObject',
  'axlAddSimpleMove',
  'axlDBAddProp',
  'axlDBChangeProp',
  'axlDBDeleteProp',
  'axlDBDefineAlias',
  'axlDBAddPin',
  'axlDBCreateSymbol',
  'axlDBPadstackChange',
  'outfile',
  'write(',
  'axlUIWPrint',
  'axlDBSet',
  'axlShell',
];

/** 按关键字分类命令风险（启发式，仅用于 UI 二次确认提示） */
export function classifyCommandRisk(code: string): SessionCommandRisk {
  const normalized = code.toLowerCase();
  return WRITE_APIS.some((api) => normalized.includes(api.toLowerCase())) ? 'write' : 'readonly';
}

/** 执行 SKILL 命令 */
export async function executeSessionCommand(
  code: string,
  timeoutMs = 15000,
): Promise<SessionCommandResult> {
  const workspace = findBridgeWorkspace();
  if (!workspace) {
    return { success: false, output: '', durationMs: 0, error: '未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE。' };
  }
  if (!code || !code.trim()) {
    return { success: false, output: '', durationMs: 0, error: '命令不能为空。' };
  }
  if (code.length > 20000) {
    return { success: false, output: '', durationMs: 0, error: '命令过长（超过 20000 字符）。' };
  }

  const startedAt = Date.now();
  const result = await executeSkillViaBridge(workspace, code.trim(), timeoutMs);
  const durationMs = Date.now() - startedAt;
  if (!result.success) {
    return { success: false, output: '', durationMs, error: result.error || 'Vibe Bridge 执行出错。' };
  }
  return { success: true, output: result.output ?? '', durationMs };
}
