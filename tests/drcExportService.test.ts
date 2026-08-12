/**
 * ATM - DRC 导出服务单元测试
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseDrcReport } from '../core/drc/drcReportParser';
import {
  drcExportFileName,
  exportDrcCsv,
  exportDrcHtml,
  exportDrcMarkdown,
} from '../core/drc/drcExportService';
import type { DrcExportFormat, DrcReport } from '../src/types/drc';

const FIXTURES_DIR = path.join(__dirname, '..', 'test-fixtures', 'drc');

function buildReport(): DrcReport {
  const parsed = parseDrcReport(fs.readFileSync(path.join(FIXTURES_DIR, 'drc.basic.rpt'), 'utf-8'));
  return {
    ...parsed,
    id: 'drc_export_test',
    sourceType: 'file',
    importedAt: '2026-08-12T08:00:00.000Z',
    rawHash: 'b'.repeat(64),
  };
}

describe('exportDrcMarkdown', () => {
  it('应输出标题、摘要表与明细表', () => {
    const report = buildReport();
    const md = exportDrcMarkdown({ report });
    expect(md).toContain('# DRC Report');
    expect(md).toContain('| 总数 | 错误 | 警告 | 已解决 | 已忽略 |');
    expect(md).toContain('| 4 | 3 | 1 | 0 | 0 |');
    expect(md).toContain('SPMHCS-1');
    expect(md).toContain('Mils');
  });

  it('应只导出传入的违规子集', () => {
    const report = buildReport();
    const subset = report.violations.slice(0, 2);
    const md = exportDrcMarkdown({ report, violations: subset });
    expect(md).toContain('## 明细（2 条）');
    expect(md.split('| SPMHCS-1 |').length - 1).toBe(1);
  });

  it('描述中的管道符应被转义', () => {
    const report = buildReport();
    report.violations[0].description = 'a | b';
    const md = exportDrcMarkdown({ report });
    expect(md).toContain('a \\| b');
  });
});

describe('exportDrcHtml', () => {
  it('应输出完整 HTML 文档与摘要', () => {
    const report = buildReport();
    const html = exportDrcHtml({ report });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>DRC Report</title>');
    expect(html).toContain('<b>4</b>总数');
    expect(html).toContain('severity-error');
    expect(html).toContain('SPMHCS-1');
  });

  it('应转义 HTML 特殊字符', () => {
    const report = buildReport();
    report.violations[0].description = '<script>alert(1)</script>';
    const html = exportDrcHtml({ report });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('exportDrcCsv', () => {
  it('应输出元数据头、表头与数据行', () => {
    const report = buildReport();
    const csv = exportDrcCsv({ report });
    const lines = csv.split(/\r?\n/);
    expect(lines[0]).toContain('# 设计:');
    expect(lines[2]).toContain('# 单位:Mils');
    expect(lines[4]).toBe('状态,规则,严重度,层,网络,元件,引脚,X,Y,实际值,期望值,说明');
    expect(lines[5]).toContain('SPMHCS-1');
    expect(lines[5]).toContain('1234.56');
  });

  it('含逗号或引号的单元格应被引号包裹', () => {
    const report = buildReport();
    report.violations[0].description = 'a,"b"';
    const csv = exportDrcCsv({ report });
    expect(csv).toContain('"a,""b"""');
  });
});

describe('drcExportFileName', () => {
  const report = buildReport();

  it('应生成对应格式的扩展名', () => {
    expect(drcExportFileName({ report }, 'markdown')).toBe('DRC Report.md');
    expect(drcExportFileName({ report }, 'html')).toBe('DRC Report.html');
    expect(drcExportFileName({ report }, 'csv')).toBe('DRC Report.csv');
  });

  it('应清理文件名中的非法字符', () => {
    const weird = { ...report, name: '报告: 测试/?*' };
    expect(drcExportFileName({ report: weird }, 'csv')).toBe('报告_ 测试___.csv');
  });

  it('应优先使用传入文件名', () => {
    expect(drcExportFileName({ report, fileName: 'my-report' }, 'html')).toBe('my-report.html');
  });

  it('空文件名应回退默认名', () => {
    const weird = { ...report, name: '///' };
    expect(drcExportFileName({ report: weird }, 'csv')).toBe('drc-report.csv');
  });
});

describe('导出格式与 IPC 兼容', () => {
  it('三种格式均可用且非空', () => {
    const report = buildReport();
    const formats: DrcExportFormat[] = ['markdown', 'html', 'csv'];
    for (const format of formats) {
      const content = format === 'markdown'
        ? exportDrcMarkdown({ report })
        : format === 'html'
          ? exportDrcHtml({ report })
          : exportDrcCsv({ report });
      expect(content.length).toBeGreaterThan(50);
    }
  });
});
