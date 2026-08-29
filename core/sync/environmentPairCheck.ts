/**
 * ATM - 环境对前置校验（V6.4，M0）
 *
 * 跨版本同步的两个环境必须满足：
 *  - pcbenv 目录不同（共享目录时同步会互相覆盖，直接阻塞）；
 *  - 版本不同（同版本同步交给普通方案同步/复制即可）；
 *  - 目录存在且可写。
 * 纯函数、可测试。
 */
import path from 'path';
import type {
  CrossVersionSyncEnvironmentRef,
  EnvironmentPairCheckResult,
} from '../../src/types/sync';

export interface EnvironmentPairInput {
  source: CrossVersionSyncEnvironmentRef;
  target: CrossVersionSyncEnvironmentRef;
  /** 目录是否存在（由调用方探测后传入） */
  sourceExists?: boolean;
  targetExists?: boolean;
}

function normalizeDirectory(input: string | undefined): string {
  if (!input) return '';
  return path
    .normalize(input)
    .replace(/[\\/]+$/, '')
    .toLowerCase();
}

/** 判断两个环境是否指向同一 pcbenv 目录 */
export function isSamePcbenvDirectory(
  source: CrossVersionSyncEnvironmentRef,
  target: CrossVersionSyncEnvironmentRef,
): boolean {
  const left = normalizeDirectory(source.pcbenvPath || source.homePath);
  const right = normalizeDirectory(target.pcbenvPath || target.homePath);
  return Boolean(left && right && left === right);
}

/** 执行环境对前置校验 */
export function checkEnvironmentPair(input: EnvironmentPairInput): EnvironmentPairCheckResult {
  const issues: string[] = [];
  const { source, target } = input;

  const sameDirectory = isSamePcbenvDirectory(source, target);
  const sameVersion = (source.version || '').toLowerCase() === (target.version || '').toLowerCase();

  if (!source.pcbenvPath && !source.homePath) {
    issues.push('源环境缺少 pcbenv 目录，请先在环境页确认');
  }
  if (!target.pcbenvPath && !target.homePath) {
    issues.push('目标环境缺少 pcbenv 目录，请先在环境页确认');
  }
  if (input.sourceExists === false) {
    issues.push(`源环境目录不存在：${source.pcbenvPath || source.homePath || ''}`);
  }
  if (input.targetExists === false) {
    issues.push(`目标环境目录不存在：${target.pcbenvPath || target.homePath || ''}`);
  }
  if (sameDirectory) {
    issues.push(
      '源与目标环境指向同一 pcbenv 目录，同步会互相覆盖，请先在环境页为两个版本选择独立的配置目录',
    );
  }
  if (sameVersion) {
    issues.push('源与目标环境是同一 Allegro 版本，跨版本同步不适用于同版本环境');
  }

  return {
    ok: issues.length === 0,
    issues,
    sameDirectory,
    sameVersion,
  };
}
