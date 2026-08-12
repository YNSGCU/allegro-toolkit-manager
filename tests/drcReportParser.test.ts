/**
 * ATM - DRC 报告解析单元测试
 * 测试场景：
 *   1. 标准英文 .rpt 报告解析（头部 / Summary / 违规属性）
 *   2. 中文报告（中文字段名与描述）
 *   3. Extracta CSV 解析
 *   4. 容错：大小写不统一、多行描述、缺字段、未知 section
 *   5. 未知 / 空内容识别
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  detectFormat,
  parseDrcReport,
  parseRptText,
  parseExtractaCsv,
  splitCsvLine,
} from '../core/drc/drcReportParser';

const FIXTURES_DIR = path.join(__dirname, '..', 'test-fixtures', 'drc');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

describe('detectFormat - 格式识别', () => {
  it('应识别标准 .rpt 报告为 rpt-text', () => {
    expect(detectFormat(readFixture('drc.basic.rpt'))).toBe('rpt-text');
  });

  it('应识别中文报告为 rpt-text', () => {
    expect(detectFormat(readFixture('drc.chinese.rpt'))).toBe('rpt-text');
  });

  it('应识别 Extracta CSV 为 extracta-csv', () => {
    expect(detectFormat(readFixture('drc.extracta.csv'))).toBe('extracta-csv');
  });

  it('空字符串与无法识别的内容应返回 unknown', () => {
    expect(detectFormat('')).toBe('unknown');
    expect(detectFormat('随便一段文本\n没有报告结构')).toBe('unknown');
  });
});

describe('parseRptText - 标准英文报告', () => {
  const parsed = parseRptText(readFixture('drc.basic.rpt'));

  it('应解析头部元数据', () => {
    expect(parsed.format).toBe('rpt-text');
    expect(parsed.name).toBe('DRC Report');
    expect(parsed.designName).toBe('C:\\projects\\demo.brd');
    expect(parsed.allegroVersion).toBe('17.4-2019 S039');
    expect(parsed.units).toBe('Mils');
    expect(parsed.exportedAt).toBe('Mon Aug 12 14:30:00 2026');
  });

  it('应解析全部违规条目与严重级别', () => {
    expect(parsed.violations).toHaveLength(4);
    const errors = parsed.violations.filter((v) => v.severity === 'error');
    const warnings = parsed.violations.filter((v) => v.severity === 'warning');
    expect(errors).toHaveLength(3);
    expect(warnings).toHaveLength(1);
  });

  it('应完整映射违规属性与坐标', () => {
    const first = parsed.violations[0];
    expect(first.rule).toBe('SPMHCS-1');
    expect(first.description).toContain('Missing solder mask');
    expect(first.category).toBe('Soldermask');
    expect(first.constraintType).toBe('SolderMask');
    expect(first.layer).toBe('TOP');
    expect(first.net).toBe('VCC');
    expect(first.component).toBe('U1');
    expect(first.pin).toBe('5');
    expect(first.actual).toBe('0.00');
    expect(first.expected).toBe('3.00');
    expect(first.location).toEqual({ x: 1234.56, y: 789.01, units: 'Mils' });
    expect(first.sourceLine).toBe(16);
  });

  it('应生成稳定 id 并记录原始行', () => {
    const first = parsed.violations[0];
    expect(first.id).toMatch(/^drc_[0-9a-f]+$/);
    expect(first.raw).toContain('ERROR(SPMHCS-1)');
    expect(first.count).toBe(1);
    expect(first.status).toBe('unresolved');
  });

  it('应聚合四维分组统计', () => {
    expect(parsed.summary.total).toBe(4);
    expect(parsed.summary.errors).toBe(3);
    expect(parsed.summary.warnings).toBe(1);
    expect(parsed.summary.byRule.find((g) => g.name === 'SPMHCS-1')?.count).toBe(2);
    expect(parsed.summary.byRule.find((g) => g.name === 'SPMHGE-16')?.count).toBe(2);
    expect(parsed.summary.byLayer.find((g) => g.name === 'TOP')?.count).toBe(3);
    expect(parsed.summary.byLayer.find((g) => g.name === 'BOTTOM')?.count).toBe(1);
    expect(parsed.summary.byNet.find((g) => g.name === 'VCC')?.count).toBe(2);
    expect(parsed.summary.byNet.find((g) => g.name === 'GND')?.count).toBe(2);
    expect(parsed.summary.byType.find((g) => g.name === 'SolderMask')?.count).toBe(2);
    expect(parsed.summary.byType.find((g) => g.name === 'ThermalRelief')?.count).toBe(2);
  });
});

describe('parseRptText - 中文报告', () => {
  const parsed = parseRptText(readFixture('drc.chinese.rpt'));

  it('应解析中文字段名', () => {
    expect(parsed.name).toBe('DRC 报告');
    expect(parsed.designName).toBe('D:\\项目\\主板.brd');
    expect(parsed.allegroVersion).toBe('17.4');
    expect(parsed.units).toBe('mil');
  });

  it('应映射中文违规属性', () => {
    expect(parsed.violations).toHaveLength(2);
    const first = parsed.violations[0];
    expect(first.rule).toBe('SPMHCS-1');
    expect(first.severity).toBe('error');
    expect(first.category).toBe('阻焊');
    expect(first.constraintType).toBe('SolderMask');
    expect(first.layer).toBe('TOP');
    expect(first.net).toBe('VCC');
    expect(first.component).toBe('U1');
    expect(first.pin).toBe('5');
    expect(first.location).toEqual({ x: 100, y: 200, units: 'mil' });
    expect(first.actual).toBe('0.00');
    expect(first.expected).toBe('3.00');
  });

  it('应识别警告条目', () => {
    const warning = parsed.violations.find((v) => v.severity === 'warning');
    expect(warning).toBeDefined();
    expect(warning!.rule).toBe('SPMHGE-16');
    expect(warning!.layer).toBe('BOTTOM');
  });
});

describe('parseExtractaCsv - CSV 报告', () => {
  const parsed = parseExtractaCsv(readFixture('drc.extracta.csv'));

  it('应解析元数据头', () => {
    expect(parsed.format).toBe('extracta-csv');
    expect(parsed.designName).toBe('C:\\projects\\demo.brd');
    expect(parsed.allegroVersion).toBe('17.4-2019 S039');
    expect(parsed.units).toBe('Mils');
    expect(parsed.exportedAt).toBe('2026-08-12 14:30:00');
  });

  it('应按表头映射列并合成坐标', () => {
    expect(parsed.violations).toHaveLength(3);
    const first = parsed.violations[0];
    expect(first.rule).toBe('SPMHCS-1');
    expect(first.severity).toBe('error');
    expect(first.layer).toBe('TOP');
    expect(first.net).toBe('VCC');
    expect(first.component).toBe('U1');
    expect(first.pin).toBe('5');
    expect(first.location).toEqual({ x: 1234.56, y: 789.01, units: 'Mils' });
    expect(first.actual).toBe('0.00');
    expect(first.expected).toBe('3.00');
  });

  it('应识别 Severity 列并容忍空单元格', () => {
    const warning = parsed.violations[1];
    expect(warning.severity).toBe('warning');
    expect(warning.rule).toBe('SPMHGE-16');
    expect(warning.actual).toBeUndefined();
    expect(warning.expected).toBeUndefined();
    expect(warning.location).toEqual({ x: 10, y: 20, units: 'Mils' });
  });

  it('无 Severity 列时应默认 error', () => {
    const csv = [
      'Rule,Layer,Net',
      'SPMHCS-1,TOP,VCC',
      'SPMHGE-16,BOTTOM,GND',
    ].join('\n');
    const result = parseExtractaCsv(csv);
    expect(result.violations).toHaveLength(2);
    expect(result.violations.every((v) => v.severity === 'error')).toBe(true);
  });

  it('应忽略无法识别的数据行并记录 warning', () => {
    const csv = [
      'Rule,Layer,Net',
      'SPMHCS-1,TOP,VCC',
      'not,a,valid,row,with,numbers,1,2,3',
    ].join('\n');
    const result = parseExtractaCsv(csv);
    expect(result.violations).toHaveLength(1);
    expect(result.parseWarnings.some((w) => w.includes('无法识别'))).toBe(true);
  });
});

describe('parseRptText - 容错', () => {
  const parsed = parseRptText(readFixture('drc.weird.rpt'));

  it('应容忍大小写不统一与空行', () => {
    expect(parsed.name).toBe('weird report');
    expect(parsed.units).toBe('mils');
    expect(parsed.violations).toHaveLength(3);
  });

  it('应规范化规则码与层名', () => {
    const rules = parsed.violations.map((v) => v.rule);
    expect(rules).toContain('SPMHCS-1');
    expect(rules).toContain('SPMHGE-16');
    const layers = parsed.violations.map((v) => v.layer);
    expect(layers).toContain('TOP');
    expect(layers).toContain('BOTTOM');
  });

  it('应合并多行描述', () => {
    const first = parsed.violations[0];
    expect(first.description).toContain('missing solder mask');
    expect(first.description).toContain('this is a');
    expect(first.description).toContain('multi-line description');
    expect(first.location).toEqual({ x: 1, y: 2, units: 'mils' });
  });

  it('缺字段的条目仍应保留', () => {
    const second = parsed.violations[1];
    expect(second.severity).toBe('warning');
    expect(second.net).toBeUndefined();
    expect(second.location).toBeUndefined();
  });

  it('应跳过未知 section 并记录 warning，不中断后续解析', () => {
    expect(parsed.parseWarnings.some((w) => w.includes('无法识别'))).toBe(true);
    expect(parsed.violations[2].rule).toBe('SPMHCS-1');
    expect(parsed.summary.total).toBe(3);
  });
});

describe('parseDrcReport - 统一入口', () => {
  it('应分发到对应解析器', () => {
    expect(parseDrcReport(readFixture('drc.basic.rpt')).format).toBe('rpt-text');
    expect(parseDrcReport(readFixture('drc.extracta.csv')).format).toBe('extracta-csv');
  });

  it('无法识别的内容应返回 unknown 与中文提示', () => {
    const result = parseDrcReport('这不是一份 DRC 报告');
    expect(result.format).toBe('unknown');
    expect(result.violations).toHaveLength(0);
    expect(result.parseWarnings.length).toBeGreaterThan(0);
    expect(result.summary.total).toBe(0);
  });
});

describe('splitCsvLine - CSV 行分割', () => {
  it('应支持引号包裹与转义引号', () => {
    expect(splitCsvLine('a,"b,c","d""e"')).toEqual(['a', 'b,c', 'd"e']);
  });

  it('应支持空单元格', () => {
    expect(splitCsvLine('a,,c,')).toEqual(['a', '', 'c', '']);
  });
});
