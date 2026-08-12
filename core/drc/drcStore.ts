/**
 * ATM - DRC 报告本地存储模块
 *
 * 存储位置：%APPDATA%/AllegroToolkitManager/drc/
 *   - index.json            摘要索引（最近 100 条）
 *   - reports/<id>.json     完整解析结果
 *   - raw/<id>.txt          原始报告文本
 *
 * 所有写入采用「临时文件 + 原子替换」，保存失败抛错，禁止假成功。
 * 导入时按原始文本 SHA-256 去重。
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  DrcImportInput,
  DrcImportResult,
  DrcParsedReport,
  DrcReport,
  DrcReportSummary,
  DrcSourceType,
  DrcStatusUpdateInput,
} from '../../src/types/drc';
import { parseDrcReport } from './drcReportParser';
import { buildSummary } from './drcStats';

const MAX_INDEX = 100;
const STORE_DIR = 'drc';

/** 应用级数据根目录（与 environmentRegistry / colorSchemeManager 一致） */
export function getAppDataDir(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'AllegroToolkitManager');
}

/** DRC 存储根目录 */
export function getDrcStoreDir(): string {
  return path.join(getAppDataDir(), STORE_DIR);
}

function indexPath(): string {
  return path.join(getDrcStoreDir(), 'index.json');
}

function reportPath(id: string): string {
  return path.join(getDrcStoreDir(), 'reports', `${id}.json`);
}

function rawPath(id: string): string {
  return path.join(getDrcStoreDir(), 'raw', `${id}.txt`);
}

function ensureDirs(): void {
  fs.mkdirSync(path.join(getDrcStoreDir(), 'reports'), { recursive: true });
  fs.mkdirSync(path.join(getDrcStoreDir(), 'raw'), { recursive: true });
}

/** 原子写入：先写临时文件再替换 */
function atomicWrite(filePath: string, data: string): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, data, 'utf-8');
  fs.renameSync(tmp, filePath);
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

function loadIndex(): DrcReportSummary[] {
  try {
    const filePath = indexPath();
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIndex(index: DrcReportSummary[]): void {
  ensureDirs();
  atomicWrite(indexPath(), JSON.stringify(index, null, 2));
}

function toSummary(report: DrcReport): DrcReportSummary {
  return {
    id: report.id,
    name: report.name,
    sourceType: report.sourceType,
    format: report.format,
    designName: report.designName,
    allegroVersion: report.allegroVersion,
    units: report.units,
    exportedAt: report.exportedAt,
    importedAt: report.importedAt,
    rawHash: report.rawHash,
    summary: report.summary,
  };
}

function saveReport(report: DrcReport): void {
  ensureDirs();
  atomicWrite(reportPath(report.id), JSON.stringify(report, null, 2));
}

/** 生成报告 id */
export function makeDrcReportId(content: string): string {
  return `drc_${sha256(content).slice(0, 16)}`;
}

/**
 * 导入报告：解析 → SHA-256 去重 → 原子落盘 → 更新索引。
 * 内容相同（rawHash 一致）时返回 duplicate，不重复存储。
 */
export function importDrcReport(input: DrcImportInput): DrcImportResult {
  const parsed = parseDrcReport(input.content);
  return importParsedDrcReport(parsed, input.content, input.sourceType);
}

/**
 * 直接导入已解析的报告（Bridge 在线抓取走此入口）。
 * 原始文本 SHA-256 去重，原子落盘，更新索引。
 */
export function importParsedDrcReport(
  parsed: DrcParsedReport,
  rawText: string,
  sourceType: DrcSourceType,
): DrcImportResult {
  if (!rawText || rawText.trim() === '') {
    throw new Error('报告内容为空，无法导入');
  }
  const rawHash = sha256(rawText);
  const existing = loadIndex().find((item) => item.rawHash === rawHash);
  if (existing) {
    const report = getDrcReport(existing.id);
    if (report) {
      return { report, duplicate: true, existingId: existing.id };
    }
  }

  const now = new Date().toISOString();
  const id = makeDrcReportId(rawText);
  const report: DrcReport = {
    ...parsed,
    id,
    sourceType,
    importedAt: now,
    rawHash,
  };

  ensureDirs();
  fs.writeFileSync(rawPath(id), rawText, 'utf-8');
  saveReport(report);

  const index = loadIndex();
  index.unshift(toSummary(report));
  saveIndex(index.slice(0, MAX_INDEX));

  return { report, duplicate: false };
}

/** 报告列表（摘要级，不含违规明细） */
export function listDrcReports(): DrcReportSummary[] {
  return loadIndex();
}

/** 完整报告；不存在或损坏时返回 null */
export function getDrcReport(id: string): DrcReport | null {
  try {
    const filePath = reportPath(id);
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!parsed || typeof parsed.id !== 'string' || !Array.isArray(parsed.violations)) return null;
    return parsed as DrcReport;
  } catch {
    return null;
  }
}

/** 原始报告文本；不存在或读取失败时返回 null */
export function getDrcRawText(id: string): string | null {
  try {
    const filePath = rawPath(id);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** 删除报告（索引 + 完整数据 + 原始文本） */
export function deleteDrcReport(id: string): boolean {
  const index = loadIndex();
  const next = index.filter((item) => item.id !== id);
  if (next.length === index.length) return false;
  for (const filePath of [reportPath(id), rawPath(id)]) {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
  }
  saveIndex(next);
  return true;
}

/**
 * 批量更新违规状态：只写报告内 violation.status（永不写 Allegro），
 * 更新后重算 summary 并同步索引。
 */
export function updateDrcViolationStatus(input: DrcStatusUpdateInput): DrcReport | null {
  const report = getDrcReport(input.reportId);
  if (!report) return null;
  const idSet = new Set(input.violationIds);
  for (const violation of report.violations) {
    if (idSet.has(violation.id)) {
      violation.status = input.status;
    }
  }
  report.summary = buildSummary(report.violations);
  saveReport(report);

  const index = loadIndex();
  const position = index.findIndex((item) => item.id === report.id);
  if (position >= 0) {
    index[position] = toSummary(report);
    saveIndex(index);
  }
  return report;
}
