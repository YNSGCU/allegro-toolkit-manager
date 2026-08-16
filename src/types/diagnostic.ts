/**
 * ATM - 设计体检（Board Diagnostic）类型定义
 */

/** 一次体检得到的板子健康快照 */
export interface BoardDiagnosticSnapshot {
  connected: boolean;
  designName?: string | null;
  designUnits?: string | null;
  /** ETCH 叠层数量 */
  layerCount: number;
  /** ETCH 叠层名称（按叠层顺序） */
  layerNames: string[];
  netCount: number;
  componentCount: number;
  drcCount: number;
  message?: string;
}
