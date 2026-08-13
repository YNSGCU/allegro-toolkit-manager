/**
 * ATM - DRC 报告解析模块
 *
 * 支持两种输入格式：
 *   1. rpt-text：Allegro Design Rules Check 报告（.rpt），section 化文本。
 *   2. extracta-csv：Extracta 向导导出的 CSV（元数据头 + 表头 + 数据行）。
 *
 * DRC 报告没有统一格式，随版本与导出设置变化。解析器采用容错策略：
 * 识别已知 section / 属性行（中英文 key），未知内容跳过并记录 warning。
 */
import type {
  DrcFileFormat,
  DrcLocation,
  DrcParsedReport,
  DrcViolation,
} from '../../src/types/drc';
import { mergeViolations, normalizeViolation, parseLocation } from './drcNormalizer';
import { buildSummary, emptySummary } from './drcStats';

const VIOLATION_HEAD =
  /^#?\s*\d*\.?\s*(ERROR|WARNING)\s*\(([^)]+)\)\s*:?\s*(.*)$/i;

const SUMMARY_LINE = /^Total\s+(Errors?|Warnings?)\s*:?\s*(\d+)/i;

const SECTION_HEADERS = [
  /Summary Statistics/i,
  /DRC ERROR DETAILS/i,
  /DRC Error List/i,
  /Errors Found/i,
  /DRC Warnings/i,
];

/** 属性 key 归一化映射（支持中英文） */
const ATTRIBUTE_KEYS: Record<string, keyof AttributeTarget> = {
  class: 'category',
  category: 'category',
  类别: 'category',
  constraint: 'constraintType',
  'constraint type': 'constraintType',
  constrainttype: 'constraintType',
  约束: 'constraintType',
  layer: 'layer',
  subclass: 'layer',
  层: 'layer',
  net: 'net',
  signal: 'net',
  网络: 'net',
  component: 'component',
  refdes: 'component',
  'reference designator': 'component',
  元件: 'component',
  pin: 'pin',
  'pin number': 'pin',
  引脚: 'pin',
  location: 'location',
  origin: 'location',
  xy: 'location',
  位置: 'location',
  actual: 'actual',
  'actual value': 'actual',
  measured: 'actual',
  实际值: 'actual',
  expected: 'expected',
  required: 'expected',
  'constraint value': 'expected',
  期望值: 'expected',
  waived: 'waived',
  fixed: 'fixed',
};

/** 头部 key 归一化映射（支持中英文） */
const HEADER_KEYS: Record<string, keyof ReportHeader> = {
  'report name': 'name',
  'reportname': 'name',
  报告名称: 'name',
  报告名: 'name',
  'design name': 'designName',
  design: 'designName',
  设计文件: 'designName',
  设计名称: 'designName',
  'allegro version': 'allegroVersion',
  'allegro 版本': 'allegroVersion',
  version: 'allegroVersion',
  'allegro版本': 'allegroVersion',
  版本: 'allegroVersion',
  units: 'units',
  单位: 'units',
  'report time': 'exportedAt',
  time: 'exportedAt',
  date: 'exportedAt',
  generated: 'exportedAt',
  报告时间: 'exportedAt',
};

interface AttributeTarget {
  category?: string;
  constraintType?: string;
  layer?: string;
  net?: string;
  component?: string;
  pin?: string;
  location?: string;
  actual?: string;
  expected?: string;
  waived?: boolean;
  fixed?: boolean;
}

interface ReportHeader {
  name?: string;
  designName?: string;
  allegroVersion?: string;
  units?: string;
  exportedAt?: string;
}

interface PartialViolation {
  severity: DrcViolation['severity'];
  rule?: string;
  description?: string;
  sourceLine?: number;
  raw?: string;
  attrs: AttributeTarget;
  extraDescription: string[];
}

/** 按行分割（保留末尾空行处理） */
function splitLines(content: string): string[] {
  if (content === '') return [];
  return content.split(/\r?\n/);
}

/** 识别报告格式 */
export function detectFormat(content: string): DrcFileFormat {
  const head = splitLines(content)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
  const rptScore = head.filter(
    (line) => VIOLATION_HEAD.test(line) || /Summary Statistics/i.test(line),
  ).length;
  if (rptScore > 0) return 'rpt-text';
  // CSV：第一个非注释行应为表头（含逗号且可拆成多列，且不是违规头）
  const firstDataLine = head.find(
    (line) => !line.startsWith('#') && !/^[\w\u4e00-\u9fa5\s-]+\s*:/.test(line),
  );
  const looksCsv = firstDataLine !== undefined
    && firstDataLine.includes(',')
    && !VIOLATION_HEAD.test(firstDataLine)
    && splitCsvLine(firstDataLine).length >= 2;
  if (looksCsv) return 'extracta-csv';
  return 'unknown';
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return /^(yes|true|t|1|y|是)$/i.test(value.trim());
}

function assignAttribute(target: AttributeTarget, key: string, value: string): boolean {
  const mapped = ATTRIBUTE_KEYS[normalizeKey(key)];
  if (!mapped) return false;
  if (mapped === 'waived') {
    target.waived = parseBoolean(value);
  } else if (mapped === 'fixed') {
    target.fixed = parseBoolean(value);
  } else {
    target[mapped] = value.trim();
  }
  return true;
}

function assignHeader(header: ReportHeader, key: string, value: string): boolean {
  const mapped = HEADER_KEYS[normalizeKey(key)];
  if (!mapped) return false;
  header[mapped] = value.trim();
  return true;
}

/** 属性行正则：`Key: value`（key 允许中文/英文/空格/连字符） */
const ATTRIBUTE_LINE = /^([\p{L}\p{N}][\p{L}\p{N}\s-]{0,31}?)\s*:\s*(.*)$/u;

function finalizeViolation(
  partial: PartialViolation,
  header: ReportHeader,
  warnings: string[],
): DrcViolation | null {
  const rule = partial.rule?.trim();
  if (!rule) {
    warnings.push(`跳过无法识别规则的违规条目（第 ${partial.sourceLine ?? '?'} 行附近）`);
    return null;
  }
  const description = [partial.description, ...partial.extraDescription]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return normalizeViolation(
    {
      rule,
      severity: partial.severity,
      description,
      sourceLine: partial.sourceLine,
      raw: partial.raw,
      category: partial.attrs.category,
      constraintType: partial.attrs.constraintType,
      layer: partial.attrs.layer,
      net: partial.attrs.net,
      component: partial.attrs.component,
      pin: partial.attrs.pin,
      location: partial.attrs.location
        ? parseLocation(partial.attrs.location, header.units)
        : undefined,
      actual: partial.attrs.actual,
      expected: partial.attrs.expected,
      waived: partial.attrs.waived,
      fixed: partial.attrs.fixed,
    },
    header.units,
  );
}

/** 解析 Allegro DRC 报告文本（.rpt） */
export function parseRptText(content: string): DrcParsedReport {
  const warnings: string[] = [];
  const header: ReportHeader = {};
  const lines = splitLines(content);
  const violations: DrcViolation[] = [];
  let current: PartialViolation | null = null;
  let inViolationSection = false;
  let unknownSectionWarned = false;

  const flush = () => {
    if (current) {
      const violation = finalizeViolation(current, header, warnings);
      if (violation) violations.push(violation);
      current = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNumber = i + 1;

    if (trimmed === '') continue;

    // section 标题
    if (SECTION_HEADERS.some((re) => re.test(trimmed))) {
      flush();
      inViolationSection = /Error|Warning/i.test(trimmed);
      continue;
    }

    // Summary 计数
    const summary = SUMMARY_LINE.exec(trimmed);
    if (summary) continue;

    // 违规条目头行
    const head = VIOLATION_HEAD.exec(trimmed);
    if (head) {
      flush();
      current = {
        severity: head[1].toLowerCase() === 'error' ? 'error' : 'warning',
        rule: head[2].trim(),
        description: head[3].trim(),
        sourceLine: lineNumber,
        raw: trimmed,
        attrs: {},
        extraDescription: [],
      };
      inViolationSection = true;
      continue;
    }

    // 属性行（违规块内或头部区）
    const attr = ATTRIBUTE_LINE.exec(trimmed);
    if (attr) {
      const key = attr[1].trim();
      const value = attr[2].trim();
      if (current) {
        if (!assignAttribute(current.attrs, key, value)) {
          warnings.push(`忽略未知属性「${key}」（第 ${lineNumber} 行）`);
        }
      } else if (!assignHeader(header, key, value)) {
        // 头部区的未知 key：可能是设计名中的冒号等误匹配，静默跳过
      }
      continue;
    }

    // 违规块内的非属性行：多行描述容错
    if (current && inViolationSection) {
      current.extraDescription.push(trimmed);
      continue;
    }

    // 分隔线（---- / ====）与未知 section 标题：静默跳过或提示一次
    if (/^[-=*_]{3,}$/.test(trimmed)) continue;
    if (!unknownSectionWarned) {
      warnings.push(`遇到无法识别的段落（第 ${lineNumber} 行附近），已跳过`);
      unknownSectionWarned = true;
    }
  }

  flush();

  return {
    format: 'rpt-text',
    name: header.name || '',
    designName: header.designName,
    allegroVersion: header.allegroVersion,
    units: header.units,
    exportedAt: header.exportedAt,
    parseWarnings: warnings,
    summary: buildSummary(violations),
    violations: mergeViolations(violations),
  };
}

/** 简易 CSV 行分割（支持双引号包裹） */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/** CSV 列名 -> 模型字段映射 */
const CSV_COLUMNS: Record<string, keyof AttributeTarget | 'x' | 'y' | 'severity' | 'rule'> = {
  rule: 'rule',
  error: 'rule',
  'error code': 'rule',
  code: 'rule',
  severity: 'severity',
  type: 'severity',
  class: 'category',
  category: 'category',
  constraint: 'constraintType',
  'constraint type': 'constraintType',
  layer: 'layer',
  subclass: 'layer',
  net: 'net',
  signal: 'net',
  component: 'component',
  refdes: 'component',
  pin: 'pin',
  x: 'x',
  'x loc': 'x',
  y: 'y',
  'y loc': 'y',
  location: 'location',
  actual: 'actual',
  expected: 'expected',
  waived: 'waived',
  fixed: 'fixed',
};

function mapCsvColumn(headerName: string): keyof AttributeTarget | 'x' | 'y' | 'severity' | 'rule' | null {
  const key = normalizeKey(headerName);
  if (CSV_COLUMNS[key]) return CSV_COLUMNS[key];
  // 兜底：列名含关键字
  if (key.includes('rule') || key.includes('error')) return 'rule';
  if (key.includes('severity') || key.includes('type')) return 'severity';
  if (key.includes('constraint')) return 'constraintType';
  if (key.includes('layer') || key.includes('subclass')) return 'layer';
  if (key.includes('net') || key.includes('signal')) return 'net';
  if (key.includes('component') || key.includes('refdes')) return 'component';
  if (key.includes('pin')) return 'pin';
  if (key.includes('actual')) return 'actual';
  if (key.includes('expected') || key.includes('required')) return 'expected';
  if (key.includes('class') || key.includes('category')) return 'category';
  return null;
}

/** 规则码合理性格检查：字母开头，包含数字或连字符/下划线（排除普通文本列） */
function isPlausibleRule(rule: string | undefined): boolean {
  if (!rule) return false;
  if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(rule)) return false;
  return /[0-9]/.test(rule) || /[-_]/.test(rule);
}

/** 解析 Extracta CSV 报告 */
export function parseExtractaCsv(content: string): DrcParsedReport {
  const warnings: string[] = [];
  const header: ReportHeader = {};
  const lines = splitLines(content);
  let headerIndex = -1;
  let headerCells: string[] = [];
  const meta = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    if (line.startsWith('#')) {
      const m = /^([^:]+):\s*(.*)$/.exec(line.slice(1).trim());
      if (m) {
        const key = normalizeKey(m[1].trim());
        const value = m[2].trim();
        meta.set(key, value);
        if (HEADER_KEYS[key]) assignHeader(header, key, value);
      }
      continue;
    }
    headerCells = splitCsvLine(line);
    headerIndex = i;
    break;
  }

  if (headerIndex < 0) {
    return {
      format: 'extracta-csv',
      name: '',
      parseWarnings: ['CSV 文件中未找到数据表头'],
      summary: emptySummary(),
      violations: [],
    };
  }

  const columns = headerCells
    .map((cell, index) => ({ index, field: mapCsvColumn(cell) }))
    .filter((item): item is { index: number; field: Exclude<typeof item.field, null> } => item.field !== null);

  const findColumn = (field: string): number | undefined =>
    columns.find((item) => item.field === field)?.index;

  const violations: DrcViolation[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;
    const cells = splitCsvLine(line);
    const read = (field: string): string | undefined => {
      const index = findColumn(field);
      if (index === undefined || index >= cells.length) return undefined;
      const value = cells[index];
      return value === '' ? undefined : value;
    };

    const rule = read('rule');
    const layer = read('layer');
    const net = read('net');
    if ((rule && !isPlausibleRule(rule)) || (!rule && !layer && !net)) {
      warnings.push(`跳过无法识别的 CSV 数据行（第 ${i + 1} 行）`);
      continue;
    }

    const x = read('x');
    const y = read('y');
    const locationRaw = read('location');
    const severityText = read('severity');
    const severity: DrcViolation['severity'] =
      severityText && /warn/i.test(severityText) ? 'warning' : 'error';
    let location: DrcLocation | undefined;
    if (x !== undefined && y !== undefined && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) {
      location = { x: Number(x), y: Number(y), units: header.units };
    } else if (locationRaw) {
      location = parseLocation(locationRaw, header.units);
    }

    const violation = normalizeViolation(
      {
        rule: rule ?? '未知规则',
        severity,
        description: '',
        sourceLine: i + 1,
        raw: line,
        category: read('category'),
        constraintType: read('constraintType'),
        layer,
        net,
        component: read('component'),
        pin: read('pin'),
        actual: read('actual'),
        expected: read('expected'),
        waived: read('waived') ? parseBoolean(read('waived')) : undefined,
        fixed: read('fixed') ? parseBoolean(read('fixed')) : undefined,
        location,
      },
      header.units,
    );
    violations.push(violation);
  }

  return {
    format: 'extracta-csv',
    name: header.name || '',
    designName: header.designName,
    allegroVersion: header.allegroVersion,
    units: header.units,
    exportedAt: header.exportedAt,
    parseWarnings: warnings,
    summary: buildSummary(violations),
    violations: mergeViolations(violations),
  };
}

/** DRC 报告解析统一入口 */
export function parseDrcReport(content: string): DrcParsedReport {
  const format = detectFormat(content);
  if (format === 'extracta-csv') return parseExtractaCsv(content);
  if (format === 'rpt-text') return parseRptText(content);
  return {
    format: 'unknown',
    name: '无法识别的报告',
    parseWarnings: ['无法识别报告格式，请确认文件来自 Allegro DRC 报告导出。'],
    summary: emptySummary(),
    violations: [],
  };
}
