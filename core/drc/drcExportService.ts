/**
 * ATM - DRC 报告导出服务
 * 支持 Markdown / HTML / CSV 三种格式，导出内容基于传入的违规子集（筛选结果）。
 */
import type { DrcExportFormat, DrcReport, DrcViolation } from '../../src/types/drc';

export interface DrcExportOptions {
  report: DrcReport;
  /** 导出的违规子集（默认全部） */
  violations?: DrcViolation[];
  /** 导出文件名（不含扩展名） */
  fileName?: string;
}

const STATUS_LABELS: Record<DrcViolation['status'], string> = {
  unresolved: '未处理',
  resolved: '已解决',
  ignored: '已忽略',
};

function formatLocation(violation: DrcViolation): string {
  if (!violation.location) return '';
  const { x, y, units } = violation.location;
  return `${x.toFixed(2)} ${y.toFixed(2)}${units ? ` ${units}` : ''}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  const meaningful = cleaned.replace(/[_\s]+/g, '');
  return meaningful === '' ? 'drc-report' : cleaned;
}

export function exportDrcMarkdown(options: DrcExportOptions): string {
  const { report } = options;
  const violations = options.violations ?? report.violations;
  const lines: string[] = [];
  lines.push(`# ${report.name}`);
  lines.push('');
  lines.push(`- 设计：${report.designName ?? '-'}`);
  lines.push(`- Allegro 版本：${report.allegroVersion ?? '-'}`);
  lines.push(`- 单位：${report.units ?? '-'}`);
  lines.push(`- 导出时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`);
  lines.push('');
  lines.push('## 摘要');
  lines.push('');
  lines.push(`| 总数 | 错误 | 警告 | 已解决 | 已忽略 |`);
  lines.push('| --- | --- | --- | --- | --- |');
  lines.push(
    `| ${report.summary.total} | ${report.summary.errors} | ${report.summary.warnings} | ${report.summary.resolved} | ${report.summary.ignored} |`,
  );
  lines.push('');
  lines.push(`## 明细（${violations.length} 条）`);
  lines.push('');
  lines.push('| 状态 | 规则 | 严重度 | 层 | 网络 | 元件/引脚 | 位置 | 实际/期望 | 说明 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const violation of violations) {
    const cells = [
      STATUS_LABELS[violation.status],
      violation.rule,
      violation.severity === 'error' ? '错误' : '警告',
      violation.layer ?? '-',
      violation.net ?? '-',
      `${violation.component ?? '-'}${violation.pin ? `/${violation.pin}` : ''}`,
      formatLocation(violation) || '-',
      violation.actual || violation.expected
        ? `${violation.actual ?? '-'}/${violation.expected ?? '-'}`
        : '-',
      violation.description.replace(/\|/g, '\\|') || '-',
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function exportDrcHtml(options: DrcExportOptions): string {
  const { report } = options;
  const violations = options.violations ?? report.violations;
  const rows = violations.map((violation) => `
      <tr>
        <td>${escapeHtml(STATUS_LABELS[violation.status])}</td>
        <td><code>${escapeHtml(violation.rule)}</code></td>
        <td class="severity-${violation.severity}">${violation.severity === 'error' ? '错误' : '警告'}</td>
        <td>${escapeHtml(violation.layer ?? '-')}</td>
        <td>${escapeHtml(violation.net ?? '-')}</td>
        <td>${escapeHtml(violation.component ?? '-')}${violation.pin ? `/${escapeHtml(violation.pin)}` : ''}</td>
        <td>${escapeHtml(formatLocation(violation)) || '-'}</td>
        <td>${escapeHtml(violation.actual ?? '-')} / ${escapeHtml(violation.expected ?? '-')}</td>
        <td>${escapeHtml(violation.description) || '-'}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(report.name)}</title>
  <style>
    body { font-family: "Microsoft YaHei", sans-serif; margin: 24px; color: #171717; }
    h1 { font-size: 20px; }
    .meta { color: #5f5a52; font-size: 13px; margin-bottom: 16px; }
    .summary { display: flex; gap: 12px; margin-bottom: 20px; }
    .summary div { border: 1px solid #e8e1d8; border-radius: 10px; padding: 8px 14px; min-width: 72px; }
    .summary b { display: block; font-size: 18px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #e8e1d8; padding: 6px 8px; text-align: left; }
    th { background: #faf8f5; }
    .severity-error { color: #b42318; font-weight: 600; }
    .severity-warning { color: #b7791f; font-weight: 600; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.name)}</h1>
  <div class="meta">
    设计：${escapeHtml(report.designName ?? '-')} ｜
    Allegro：${escapeHtml(report.allegroVersion ?? '-')} ｜
    单位：${escapeHtml(report.units ?? '-')} ｜
    导出：${new Date().toLocaleString('zh-CN', { hour12: false })}
  </div>
  <div class="summary">
    <div><b>${report.summary.total}</b>总数</div>
    <div><b>${report.summary.errors}</b>错误</div>
    <div><b>${report.summary.warnings}</b>警告</div>
    <div><b>${report.summary.resolved}</b>已解决</div>
    <div><b>${report.summary.ignored}</b>已忽略</div>
  </div>
  <h2>明细（${violations.length} 条）</h2>
  <table>
    <thead>
      <tr><th>状态</th><th>规则</th><th>严重度</th><th>层</th><th>网络</th><th>元件/引脚</th><th>位置</th><th>实际/期望</th><th>说明</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</body>
</html>
`;
}

export function exportDrcCsv(options: DrcExportOptions): string {
  const { report } = options;
  const violations = options.violations ?? report.violations;
  const header = ['状态', '规则', '严重度', '层', '网络', '元件', '引脚', 'X', 'Y', '实际值', '期望值', '说明'];
  const rows = violations.map((violation) => [
    STATUS_LABELS[violation.status],
    violation.rule,
    violation.severity === 'error' ? '错误' : '警告',
    violation.layer ?? '',
    violation.net ?? '',
    violation.component ?? '',
    violation.pin ?? '',
    violation.location ? String(violation.location.x) : '',
    violation.location ? String(violation.location.y) : '',
    violation.actual ?? '',
    violation.expected ?? '',
    violation.description,
  ].map(escapeCsv).join(','));
  const meta = [
    `# 设计:${report.designName ?? ''}`,
    `# Allegro 版本:${report.allegroVersion ?? ''}`,
    `# 单位:${report.units ?? ''}`,
    `# 导出时间:${new Date().toLocaleString('zh-CN', { hour12: false })}`,
  ];
  return '\uFEFF' + [...meta, header.join(','), ...rows].join('\r\n') + '\r\n';
}

export function drcExportFileName(options: DrcExportOptions, format: DrcExportFormat): string {
  const base = sanitizeFileName(options.fileName ?? options.report.name);
  const extension = format === 'markdown' ? 'md' : format;
  return `${base}.${extension}`;
}
