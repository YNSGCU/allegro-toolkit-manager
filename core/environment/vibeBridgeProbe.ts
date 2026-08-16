import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AllegroEnvironmentWorkspace, AllegroRuntimeVerificationResult } from '../../src/types/environment';
import { executeSkillViaBridge } from '../color/vibeColorBridge';

export const VIBE_VERSION_QUERY = "list(axlVersion('fullVersion) axlVersion('programName))";

function candidateWorkspaces(): string[] {
  const candidates = [
    process.env.ATM_VIBE_WORKSPACE,
    path.join(os.homedir(), '.codex', 'skills', 'allegro-vibe-bridge', 'workspace'),
    path.join(os.homedir(), 'allegro_vibe_bridge', 'workspace'),
  ].filter(Boolean) as string[];
  return [...new Set(candidates.map((item) => path.normalize(item)))];
}

export function parseVibeVersionResponse(raw: string): { version: string | null; fullVersion: string | null; programName: string | null } | null {
  if (!raw.trim().startsWith('SUCCESS')) return null;
  const payload = raw.replace(/^SUCCESS\s*/i, '').trim();
  const quoted = [...payload.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
  // fullVersion 恒为倒数第二个引号串，programName 恒为最后一个；短版本从 fullVersion 派生（"17.2-2016 S083" → "17.2"）
  if (quoted.length >= 2) {
    const fullVersion = quoted[quoted.length - 2] || null;
    const programName = quoted[quoted.length - 1] || null;
    const version = fullVersion ? (fullVersion.split(/[-\s]/)[0] || null) : null;
    return { version, fullVersion, programName };
  }
  const tokens = payload.replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return { version: tokens[0] || null, fullVersion: tokens[1] || null, programName: tokens[2] || null };
}

export async function verifyAllegroRuntimeViaVibeBridge(
  environment: Pick<AllegroEnvironmentWorkspace, 'allegroVersion'>,
  timeoutMs = 5000,
): Promise<AllegroRuntimeVerificationResult> {
  const workspace = candidateWorkspaces().find((candidate) => fs.existsSync(candidate));
  const base = {
    expectedVersion: environment.allegroVersion,
    actualVersion: null,
    fullVersion: null,
    programName: null,
    bridgeWorkspace: workspace || null,
  };
  if (!workspace) return { ...base, connected: false, matchedEnvironment: false, status: 'unverified', message: '未找到 Vibe Bridge workspace，请先安装或设置 ATM_VIBE_WORKSPACE。' };

  try {
    const result = await executeSkillViaBridge(workspace, VIBE_VERSION_QUERY, timeoutMs);
    if (!result.success) {
      return { ...base, connected: false, matchedEnvironment: false, status: 'unverified', message: result.error || 'Vibe Bridge 未响应，请在 Allegro 中加载并启动 Bridge 服务。' };
    }
    const parsed = parseVibeVersionResponse('SUCCESS ' + result.output);
    if (!parsed) {
      return { ...base, connected: true, matchedEnvironment: false, status: 'warning', message: 'Vibe Bridge 返回了错误，未记录运行验证通过。' };
    }
    const matchedEnvironment = !environment.allegroVersion || parsed.version?.startsWith(environment.allegroVersion) === true;
    return {
      ...base,
      connected: true,
      matchedEnvironment,
      actualVersion: parsed.version,
      fullVersion: parsed.fullVersion,
      programName: parsed.programName,
      status: matchedEnvironment ? 'runtime_pass' : 'warning',
      message: matchedEnvironment ? `已连接 ${parsed.fullVersion || parsed.version || 'Allegro'}，版本与当前环境一致。` : `当前会话版本 ${parsed.version || '未知'} 与所选环境 ${environment.allegroVersion || '未知'} 不一致。`,
    };
  } catch (err) {
    return { ...base, connected: false, matchedEnvironment: false, status: 'unverified', message: `Vibe Bridge 验证失败: ${err instanceof Error ? err.message : String(err)}` };
  }
}
