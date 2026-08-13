/**
 * ATM - Allegro 会话控制台类型定义
 */

/** 会话快照（只读探测结果） */
export interface SessionSnapshot {
  connected: boolean;
  fullVersion?: string;
  programName?: string;
  designName?: string;
  designUnits?: string;
  message?: string;
}

/** 控制台命令执行结果 */
export interface SessionCommandResult {
  success: boolean;
  output: string;
  durationMs: number;
  error?: string;
}

/** 命令风险分类 */
export type SessionCommandRisk = 'readonly' | 'write';
