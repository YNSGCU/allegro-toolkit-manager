/**
 * ATM - DRC 报告存储单元测试
 * 测试场景：
 *   1. 导入 / 列表 / 详情 / 删除 CRUD
 *   2. SHA-256 去重
 *   3. 状态批量更新与摘要同步
 *   4. 原子写入（无 .tmp 残留）
 *   5. 损坏文件容错
 *   6. 索引上限（最近 100 条）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  importDrcReport,
  importParsedDrcReport,
  listDrcReports,
  getDrcReport,
  deleteDrcReport,
  updateDrcViolationStatus,
  getDrcStoreDir,
} from '../core/drc/drcStore';
import { parseDrcReport } from '../core/drc/drcReportParser';

const FIXTURES_DIR = path.join(__dirname, '..', 'test-fixtures', 'drc');
const ORIGINAL_APPDATA = process.env.APPDATA;

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-drc-test-'));
  process.env.APPDATA = tempDir;
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (ORIGINAL_APPDATA === undefined) {
    delete process.env.APPDATA;
  } else {
    process.env.APPDATA = ORIGINAL_APPDATA;
  }
});

function importBasic(): ReturnType<typeof importDrcReport> {
  return importDrcReport({
    content: readFixture('drc.basic.rpt'),
    fileName: 'drc.basic.rpt',
    sourceType: 'file',
  });
}

describe('importDrcReport - 导入', () => {
  it('应解析并落盘完整报告', () => {
    const { report, duplicate } = importBasic();
    expect(duplicate).toBe(false);
    expect(report.id).toMatch(/^drc_[0-9a-f]{16}$/);
    expect(report.sourceType).toBe('file');
    expect(report.format).toBe('rpt-text');
    expect(report.rawHash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.violations).toHaveLength(4);
    expect(report.summary.total).toBe(4);
    expect(report.importedAt).toBeTruthy();
  });

  it('应保存原始文本到 raw 目录', () => {
    const { report } = importBasic();
    const rawFile = path.join(getDrcStoreDir(), 'raw', `${report.id}.txt`);
    expect(fs.existsSync(rawFile)).toBe(true);
    expect(fs.readFileSync(rawFile, 'utf-8')).toContain('Design Rules Check Report');
  });

  it('相同内容应去重返回 duplicate', () => {
    importBasic();
    const second = importBasic();
    expect(second.duplicate).toBe(true);
    expect(second.existingId).toBe(second.report.id);
    expect(listDrcReports()).toHaveLength(1);
  });

  it('不同内容不应误判重复', () => {
    importBasic();
    const other = importDrcReport({
      content: readFixture('drc.chinese.rpt'),
      sourceType: 'file',
    });
    expect(other.duplicate).toBe(false);
    expect(listDrcReports()).toHaveLength(2);
  });

  it('空内容应抛错', () => {
    expect(() =>
      importDrcReport({ content: '   ', sourceType: 'file' }),
    ).toThrow('报告内容为空');
  });
});

describe('importParsedDrcReport - 直接导入（Bridge）', () => {
  it('应直接落盘已解析的报告', () => {
    const rawText = readFixture('drc.basic.rpt');
    const parsed = parseDrcReport(rawText);
    const { report, duplicate } = importParsedDrcReport(parsed, rawText, 'bridge');
    expect(duplicate).toBe(false);
    expect(report.sourceType).toBe('bridge');
    expect(report.format).toBe('rpt-text');
    expect(report.violations).toHaveLength(4);
    expect(listDrcReports()[0].sourceType).toBe('bridge');
  });

  it('相同原始文本应去重（与文件导入互通）', () => {
    const rawText = readFixture('drc.basic.rpt');
    importDrcReport({ content: rawText, sourceType: 'file' });
    const parsed = parseDrcReport(rawText);
    const second = importParsedDrcReport(parsed, rawText, 'bridge');
    expect(second.duplicate).toBe(true);
    expect(listDrcReports()).toHaveLength(1);
  });

  it('空内容应抛错', () => {
    const parsed = parseDrcReport('');
    expect(() => importParsedDrcReport(parsed, '   ', 'bridge')).toThrow('报告内容为空');
  });
});

describe('listDrcReports / getDrcReport - 读取', () => {
  it('列表应返回摘要且不含违规明细', () => {
    importBasic();
    const list = listDrcReports();
    expect(list).toHaveLength(1);
    const item = list[0];
    expect(item.id).toBeTruthy();
    expect(item.name).toBe('DRC Report');
    expect(item.summary.total).toBe(4);
    expect((item as Record<string, unknown>).violations).toBeUndefined();
  });

  it('详情应返回完整违规数据', () => {
    const { report } = importBasic();
    const loaded = getDrcReport(report.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.violations).toHaveLength(4);
    expect(loaded!.violations[0].rule).toBe('SPMHCS-1');
  });

  it('不存在的 id 应返回 null', () => {
    expect(getDrcReport('drc_not_exist')).toBeNull();
  });
});

describe('updateDrcViolationStatus - 状态跟踪', () => {
  it('应批量更新状态并重算摘要', () => {
    const { report } = importBasic();
    const ids = report.violations.slice(0, 2).map((v) => v.id);
    const updated = updateDrcViolationStatus({
      reportId: report.id,
      violationIds: ids,
      status: 'resolved',
    });
    expect(updated).not.toBeNull();
    expect(updated!.summary.resolved).toBe(2);
    expect(updated!.violations.filter((v) => v.status === 'resolved')).toHaveLength(2);
  });

  it('状态应持久化并在列表摘要中同步', () => {
    const { report } = importBasic();
    const ids = [report.violations[0].id];
    updateDrcViolationStatus({ reportId: report.id, violationIds: ids, status: 'ignored' });

    const loaded = getDrcReport(report.id);
    expect(loaded!.violations[0].status).toBe('ignored');
    expect(loaded!.summary.ignored).toBe(1);

    const listItem = listDrcReports().find((item) => item.id === report.id);
    expect(listItem!.summary.ignored).toBe(1);
  });

  it('不存在的报告应返回 null', () => {
    expect(
      updateDrcViolationStatus({ reportId: 'missing', violationIds: [], status: 'resolved' }),
    ).toBeNull();
  });
});

describe('deleteDrcReport - 删除', () => {
  it('应删除索引、完整数据与原始文本', () => {
    const { report } = importBasic();
    const deleted = deleteDrcReport(report.id);
    expect(deleted).toBe(true);
    expect(getDrcReport(report.id)).toBeNull();
    expect(listDrcReports()).toHaveLength(0);
    expect(fs.existsSync(path.join(getDrcStoreDir(), 'raw', `${report.id}.txt`))).toBe(false);
  });

  it('删除不存在的 id 应返回 false', () => {
    expect(deleteDrcReport('drc_not_exist')).toBe(false);
  });
});

describe('容错与原子性', () => {
  it('损坏的完整报告 json 应返回 null', () => {
    const { report } = importBasic();
    const filePath = path.join(getDrcStoreDir(), 'reports', `${report.id}.json`);
    fs.writeFileSync(filePath, '{ 这不是合法 JSON', 'utf-8');
    expect(getDrcReport(report.id)).toBeNull();
  });

  it('损坏的索引 json 应返回空列表', () => {
    fs.mkdirSync(getDrcStoreDir(), { recursive: true });
    fs.writeFileSync(path.join(getDrcStoreDir(), 'index.json'), '{{{', 'utf-8');
    expect(listDrcReports()).toEqual([]);
  });

  it('导入后不应残留 .tmp 文件', () => {
    importBasic();
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });
    const leftovers = walk(getDrcStoreDir()).filter((p) => p.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
  });
});

describe('索引上限', () => {
  it('超过 100 条时只保留最近 100 条', () => {
    for (let i = 0; i < 105; i++) {
      importDrcReport({ content: `SPMHCS-1 report #${i}\n${i}`, sourceType: 'file' });
    }
    expect(listDrcReports()).toHaveLength(100);
  });
});
