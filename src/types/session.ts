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

/** 控制台命令历史记录（跨会话持久化） */
export interface SessionCommandRecord {
  code: string;
  risk: SessionCommandRisk;
  executedAt: string;
  success: boolean;
  favorite: boolean;
}

/** 控制台命令历史存储 */
export interface SessionCommandStore {
  version: number;
  items: SessionCommandRecord[];
}
