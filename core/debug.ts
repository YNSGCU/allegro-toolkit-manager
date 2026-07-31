/**
 * ATM - 调试日志控制模块（V5.4）
 *
 * 统一管理所有调试日志输出。默认关闭。
 * 开启方式：
 *   1. 环境变量：ATM_DEBUG=true
 *   2. 后续支持 UI 开关
 *
 * 错误日志（console.error/warn）不受此开关控制，始终输出。
 */
import process from 'process';

let _debugEnabled = false;

/** 初始化调试开关（从环境变量读取） */
export function initDebug(): void {
  _debugEnabled = process.env.ATM_DEBUG === 'true' || process.env.ATM_DEBUG_SKILL === 'true';
  if (_debugEnabled) {
    console.log('[ATM Debug] 调试日志已启用 (ATM_DEBUG=true)');
  }
}

/** 动态切换调试状态 */
export function setDebugEnabled(enabled: boolean): void {
  _debugEnabled = enabled;
}

/** 是否开启调试模式 */
export function isDebugEnabled(): boolean {
  return _debugEnabled;
}

/**
 * 输出调试日志（仅在 debug 开启时输出）
 * @param module 模块名，如 "CommandIndex", "EnhancedScan"
 * @param message 日志内容
 */
export function debugLog(module: string, message: string, ...args: any[]): void {
  if (!_debugEnabled) return;
  console.log(`[${module}] ${message}`, ...args);
}

/**
 * 条件调试日志 — 仅在 predicate 为 true 时输出
 * 用于特定 Skill 的调试追踪
 */
export function debugLogIf(
  predicate: boolean,
  module: string,
  message: string,
  ...args: any[]
): void {
  if (!_debugEnabled || !predicate) return;
  console.log(`[${module}] ${message}`, ...args);
}

/**
 * 计时调试（测量操作耗时）
 */
export function debugTime<T>(label: string, fn: () => T): T {
  if (!_debugEnabled) return fn();
  console.time(`[Timer] ${label}`);
  try {
    return fn();
  } finally {
    console.timeEnd(`[Timer] ${label}`);
  }
}

/**
 * 异步计时调试
 */
export async function debugTimeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!_debugEnabled) return fn();
  console.time(`[Timer] ${label}`);
  try {
    return await fn();
  } finally {
    console.timeEnd(`[Timer] ${label}`);
  }
}
