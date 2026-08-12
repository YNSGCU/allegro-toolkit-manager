/**
 * ATM - Allegro Toolkit Manager
 * DRC 设计问题报告相关类型定义
 */

/** DRC 问题严重级别 */
export type DrcSeverity = 'error' | 'warning';

/** ATM 侧问题处理状态（只存 ATM，不写 Allegro） */
export type DrcStatus = 'unresolved' | 'resolved' | 'ignored';

/** 报告来源通道 */
export type DrcSourceType = 'file' | 'bridge';

/** 报告来源格式（bridge 表示 Vibe Bridge 在线抓取） */
export type DrcFileFormat = 'rpt-text' | 'extracta-csv' | 'bridge' | 'unknown';

/** 问题坐标位置 */
export interface DrcLocation {
  x: number;
  y: number;
  units?: string;
}

/** 单条 DRC 违规 */
export interface DrcViolation {
  /** 稳定 id：rule+layer+net+xy 的 hash */
  id: string;
  /** 规则码，如 SPMHCS-1 */
  rule: string;
  /** 问题描述 */
  description: string;
  severity: DrcSeverity;
  /** Class，如 Soldermask */
  category?: string;
  /** Constraint，如 SolderMask */
  constraintType?: string;
  actual?: string;
  expected?: string;
  layer?: string;
  net?: string;
  component?: string;
  pin?: string;
  location?: DrcLocation;
  /** 同 id 去重后的聚合数量 */
  count: number;
  /** 展示用，读自 Allegro，不可修改 */
  waived: boolean;
  fixed: boolean;
  /** 原始文件行号，点击回看原文 */
  sourceLine: number;
  /** 原始文本段 */
  raw: string;
  /** ATM 侧工作流状态 */
  status: DrcStatus;
}

/** 分组统计项 */
export interface DrcGroupCount {
  name: string;
  count: number;
}

/** 报告聚合摘要（core 侧预计算，列表页不加载全量违规） */
export interface DrcSummary {
  total: number;
  errors: number;
  warnings: number;
  resolved: number;
  ignored: number;
  /** 按约束类型 / Class 分组 */
  byType: DrcGroupCount[];
  byLayer: DrcGroupCount[];
  byNet: DrcGroupCount[];
  byRule: DrcGroupCount[];
}

/** 解析器直接产出的报告（未持久化字段由存储层填充） */
export interface DrcParsedReport {
  format: DrcFileFormat;
  name: string;
  designName?: string;
  allegroVersion?: string;
  units?: string;
  exportedAt?: string;
  parseWarnings: string[];
  summary: DrcSummary;
  violations: DrcViolation[];
}

/** 完整 DRC 报告（持久化模型） */
export interface DrcReport extends DrcParsedReport {
  id: string;
  sourceType: DrcSourceType;
  importedAt: string;
  /** 原始文本 SHA-256，导入去重 */
  rawHash: string;
}

/** 报告列表摘要（不含违规明细，列表页快速加载） */
export interface DrcReportSummary {
  id: string;
  name: string;
  sourceType: DrcSourceType;
  format: DrcFileFormat;
  designName?: string;
  allegroVersion?: string;
  units?: string;
  exportedAt?: string;
  importedAt: string;
  rawHash: string;
  summary: DrcSummary;
}

/** 导入输入 */
export interface DrcImportInput {
  content: string;
  fileName?: string;
  sourceType: DrcSourceType;
}

/** IPC 导入输入（按文件路径，主进程读取后转调存储层） */
export interface DrcImportFileInput {
  filePath: string;
}

/** 导入结果（duplicate 为 true 时表示已存在同内容报告） */
export interface DrcImportResult {
  report: DrcReport;
  duplicate: boolean;
  existingId?: string;
}

/** 批量状态更新输入 */
export interface DrcStatusUpdateInput {
  reportId: string;
  violationIds: string[];
  status: DrcStatus;
}

/** 文件解析预览结果（未落盘） */
export interface DrcParseFileResult {
  fileName: string;
  byteSize: number;
  rawHash: string;
  parsed: DrcParsedReport;
}

/** 原文回看结果 */
export interface DrcRawResult {
  id: string;
  text: string;
}

/** 导出格式 */
export type DrcExportFormat = 'markdown' | 'html' | 'csv';

/** 导出输入 */
export interface DrcExportInput {
  reportId: string;
  format: DrcExportFormat;
  /** 导出的违规 id 子集（缺省导出全部） */
  violationIds?: string[];
}

/** 导出结果 */
export interface DrcExportResult {
  filePath: string;
  format: DrcExportFormat;
  count: number;
}

/** Bridge 在线抓取结果（未落盘预览） */
export interface DrcBridgeFetchResult {
  connected: boolean;
  total: number;
  rawHash: string;
  rawText: string;
  parsed: DrcParsedReport;
  message?: string;
}

/** Bridge 抓取导入输入 */
export interface DrcBridgeImportInput {
  rawText: string;
  parsed: DrcParsedReport;
}

/** 解析输入选项 */
export interface DrcParseOptions {
  /** 文件名（用于默认报告名，可选） */
  fileName?: string;
}
