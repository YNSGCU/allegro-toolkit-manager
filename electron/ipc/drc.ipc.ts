/**
 * ATM - DRC 报告 IPC 处理器
 * 数据源通道 A（文件解析/导入）与报告管理。
 * Bridge 在线抓取（通道 B）在 M6 加入，统一走 drc:bridge-* 通道。
 */
import { dialog, ipcMain } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  DrcBridgeFetchResult,
  DrcBridgeImportInput,
  DrcExportInput,
  DrcExportResult,
  DrcImportFileInput,
  DrcImportInput,
  DrcParseFileResult,
  DrcRawResult,
  DrcStatusUpdateInput,
} from '../../src/types/drc';
import { parseDrcReport } from '../../core/drc/drcReportParser';
import { fetchDrcViaBridge } from '../../core/drc/drcBridge';
import { decodeAllegroText } from '../../core/environment/allegroTextEncoding';
import { verifyAllegroRuntimeViaVibeBridge } from '../../core/environment/vibeBridgeProbe';
import { loadEnvironmentRegistry } from '../../core/environment/environmentRegistry';
import {
  drcExportFileName,
  exportDrcCsv,
  exportDrcHtml,
  exportDrcMarkdown,
} from '../../core/drc/drcExportService';
import {
  deleteDrcReport,
  getDrcReport,
  getDrcRawText,
  importDrcReport,
  importParsedDrcReport,
  listDrcReports,
  updateDrcViolationStatus,
} from '../../core/drc/drcStore';

const FILE_FILTERS = [
  { name: 'DRC 报告', extensions: ['rpt', 'csv', 'txt'] },
  { name: '所有文件', extensions: ['*'] },
];

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function registerDrcIpc(): void {
  ipcMain.handle('drc:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 DRC 报告文件',
      properties: ['openFile'],
      filters: FILE_FILTERS,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null };
    }
    return { success: true, data: result.filePaths[0] };
  });

  ipcMain.handle('drc:parse-file', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在，请重新选择。' };
      }
      const buffer = fs.readFileSync(filePath);
      const { text } = decodeAllegroText(buffer);
      const parsed = parseDrcReport(text);
      const data: DrcParseFileResult = {
        fileName: path.basename(filePath),
        byteSize: buffer.length,
        rawHash: sha256(text),
        parsed,
      };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: `解析 DRC 报告失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:import-report', (_event, input: DrcImportFileInput) => {
    try {
      if (!input?.filePath || !fs.existsSync(input.filePath)) {
        return { success: false, error: '文件不存在，无法导入。' };
      }
      const buffer = fs.readFileSync(input.filePath);
      const { text } = decodeAllegroText(buffer);
      const storeInput: DrcImportInput = {
        content: text,
        fileName: path.basename(input.filePath),
        sourceType: 'file',
      };
      const result = importDrcReport(storeInput);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `导入 DRC 报告失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:list-reports', () => {
    try {
      return { success: true, data: listDrcReports() };
    } catch (err) {
      return { success: false, error: `读取 DRC 报告列表失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:get-report', (_event, id: string) => {
    try {
      const report = getDrcReport(id);
      if (!report) return { success: false, error: '报告不存在或已损坏。' };
      return { success: true, data: report };
    } catch (err) {
      return { success: false, error: `读取 DRC 报告失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:get-raw', (_event, id: string) => {
    try {
      const text = getDrcRawText(id);
      if (text === null) return { success: false, error: '原始报告不存在或已损坏。' };
      const data: DrcRawResult = { id, text };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: `读取原始报告失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:delete-report', (_event, id: string) => {
    try {
      const deleted = deleteDrcReport(id);
      if (!deleted) return { success: false, error: '报告不存在，无法删除。' };
      return { success: true, data: { id } };
    } catch (err) {
      return { success: false, error: `删除 DRC 报告失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:update-status', (_event, input: DrcStatusUpdateInput) => {
    try {
      const report = updateDrcViolationStatus(input);
      if (!report) return { success: false, error: '报告不存在或已损坏。' };
      return { success: true, data: { report } };
    } catch (err) {
      return { success: false, error: `更新违规状态失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:export-report', async (_event, input: DrcExportInput) => {
    try {
      const report = getDrcReport(input.reportId);
      if (!report) return { success: false, error: '报告不存在或已损坏。' };
      const violations = input.violationIds && input.violationIds.length > 0
        ? report.violations.filter((v) => input.violationIds!.includes(v.id))
        : report.violations;
      if (violations.length === 0) {
        return { success: false, error: '当前没有可导出的违规条目。' };
      }

      const options = { report, violations };
      const defaultName = drcExportFileName(options, input.format);
      const saveResult = await dialog.showSaveDialog({
        title: '导出 DRC 报告',
        defaultPath: defaultName,
        filters: [
          {
            name: input.format === 'markdown' ? 'Markdown' : input.format === 'html' ? 'HTML' : 'CSV',
            extensions: [input.format === 'markdown' ? 'md' : input.format],
          },
        ],
      });
      if (saveResult.canceled || !saveResult.filePath) {
        return { success: true, data: null };
      }

      const content = input.format === 'markdown'
        ? exportDrcMarkdown(options)
        : input.format === 'html'
          ? exportDrcHtml(options)
          : exportDrcCsv(options);
      fs.writeFileSync(saveResult.filePath, content, 'utf-8');
      const data: DrcExportResult = {
        filePath: saveResult.filePath,
        format: input.format,
        count: violations.length,
      };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: `导出 DRC 报告失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:bridge-probe', async () => {
    try {
      const registry = loadEnvironmentRegistry();
      const active = registry.environments.find((item) => item.id === registry.activeEnvironmentId);
      if (!active) {
        return { success: true, data: { connected: false, message: '未选择 Allegro 环境。' } };
      }
      const result = await verifyAllegroRuntimeViaVibeBridge(active);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `探测 Vibe Bridge 失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:bridge-fetch', async () => {
    try {
      const registry = loadEnvironmentRegistry();
      const active = registry.environments.find((item) => item.id === registry.activeEnvironmentId);
      if (!active) {
        return { success: false, error: '未选择 Allegro 环境，请先在环境页选择目标环境。' };
      }
      const probe = await verifyAllegroRuntimeViaVibeBridge(active);
      if (!probe.connected || !probe.matchedEnvironment) {
        return {
          success: false,
          error: probe.message || 'Vibe Bridge 未连接或版本与当前环境不一致，请先在 Allegro 中加载桥接服务。',
        };
      }
      const result = await fetchDrcViaBridge();
      if (!result.connected) {
        return { success: false, error: result.message || 'Vibe Bridge 抓取失败。' };
      }
      const data: DrcBridgeFetchResult = result;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: `在线抓取 DRC 失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('drc:bridge-import', (_event, input: DrcBridgeImportInput) => {
    try {
      if (!input?.parsed || typeof input.rawText !== 'string') {
        return { success: false, error: '抓取结果无效，请重新抓取。' };
      }
      const result = importParsedDrcReport(input.parsed, input.rawText, 'bridge');
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `导入在线 DRC 报告失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
