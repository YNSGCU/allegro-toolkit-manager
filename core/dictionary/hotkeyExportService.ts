/**
 * ATM - Allegro Toolkit Manager
 * 快捷键导出服务
 *
 * 将快捷键绑定导出为 Markdown 或 HTML 速查表。
 * 支持按类别/来源分组、按收藏/方案/来源筛选、自定义标题与日期。
 */
import type { HotkeyBinding } from '../../src/types/hotkey';

// ──────────────────────────────────────────────
// 导出类型定义
// ──────────────────────────────────────────────

/** 导出选项 */
export interface ExportOptions {
  /** 是否包含原始命令列（默认 true） */
  includeCommand: boolean;
  /** 是否包含来源信息列（默认 false） */
  includeSource: boolean;
  /** 是否包含行号列（默认 false） */
  includeLineNumber: boolean;
  /** 分组方式（默认 'category'） */
  groupBy: 'category' | 'source' | 'none';
  /** 筛选模式（默认 'all'） */
  filterMode: 'all' | 'favorites' | 'profile' | 'source';
  /** 筛选值：profile ID 或 source 类型 */
  filterValue?: string;
  /** 自定义标题（默认 "Allegro 快捷键速查表"） */
  title?: string;
  /** 自定义日期（默认当前日期 "YYYY-MM-DD"） */
  date?: string;
}

/** 导出结果 */
export interface ExportResult {
  /** Markdown 内容 */
  markdown: string;
  /** HTML 内容 */
  html: string;
  /** 推荐文件名（不含扩展名） */
  filename: string;
  /** 绑定的总数 */
  bindingCount: number;
}

/** 内部使用的表格行数据 */
interface TableRowData {
  displayKey: string;
  type: string;
  command: string;
  chineseName: string;
  commandSource?: string;
  bindingSource?: string;
  lineNumber?: number;
  sortKey: string;
}

// ──────────────────────────────────────────────
// BindingSource → 中文标签映射
// ──────────────────────────────────────────────

const BINDING_SOURCE_LABELS: Record<string, string> = {
  user_env_original: '用户原始 env',
  atm_managed_block: 'ATM 托管',
  active_profile: '当前方案',
  install_default_env: '安装默认',
  site_env: '站点配置',
  company_env: '公司配置',
  allegro_default: 'Allegro 默认',
  system_reserved: '系统保留',
  imported_profile: '导入方案',
  generated: 'ATM 生成',
  menu_accelerator: '菜单加速键',
  unknown: '未知来源',
};

const COMMAND_SOURCE_LABELS: Record<string, string> = {
  allegro_builtin: 'Allegro 内置',
  user_skill: '用户 Skill',
  company_skill: '公司 Skill',
  atm_managed_skill: 'ATM 托管 Skill',
  ambiguous: '不明确',
  unknown: '未识别',
};

/**
 * 将 BindingSourceType 映射为中文标签。
 * @param source 快捷键来源类型
 * @returns 中文标签，未识别时返回 "未知来源"
 */
export function getBindingSourceChinese(source: string): string {
  return BINDING_SOURCE_LABELS[source] || '未知来源';
}

/**
 * 将 CommandSourceType 映射为中文标签。
 * @param source 命令来源类型
 * @returns 中文标签，未识别时返回 "未识别"
 */
export function getCommandSourceChinese(source: string): string {
  return COMMAND_SOURCE_LABELS[source] || '未识别';
}

// ──────────────────────────────────────────────
// 按键显示格式化
// ──────────────────────────────────────────────

/**
 * 获取同一物理按键的所有绑定的大小写变体，生成合并后的显示文本。
 *
 * - 同时存在小写和大写时 → "s / S"
 * - 仅存在小写 → "s"
 * - 仅存在大写 → "S"
 * - 存在修饰键（Ctrl/Alt/Shift）→ 直接返回 displayKey
 * - Alias 类型 → 返回别名名称
 *
 * @param bindings 同一物理按键的所有绑定
 * @returns 格式化后的按键显示文本
 */
export function formatKeyDisplay(bindings: HotkeyBinding[]): string {
  if (bindings.length === 0) return '';
  const first = bindings[0];

  // Alias 类型：直接返回 key
  if (first.type === 'alias') {
    return first.key || '';
  }

  // 有修饰键：使用 displayKey
  if (first.modifiers && first.modifiers.length > 0) {
    return first.displayKey || first.key || '';
  }

  // 单字母按键：检查大小写变体
  const pk = first.primaryKey || first.key || '';

  // 非单字母（如数字、F 键、标点等）直接返回
  if (!/^[A-Za-z]$/.test(pk)) {
    return first.displayKey || pk;
  }

  const hasLower = bindings.some(
    (b) => b.caseVariant === 'lower' || (b.key === b.key?.toLowerCase() && /^[a-z]$/.test(b.key))
  );
  const hasUpper = bindings.some(
    (b) => b.caseVariant === 'upper' || (b.key === b.key?.toUpperCase() && /^[A-Z]$/.test(b.key))
  );

  const lower = pk.toLowerCase();
  const upper = pk.toUpperCase();

  if (hasLower && hasUpper) {
    return `${lower} / ${upper}`;
  }
  if (hasLower) return lower;
  if (hasUpper) return upper;
  return first.displayKey || pk;
}

// ──────────────────────────────────────────────
// 排序辅助
// ──────────────────────────────────────────────

/**
 * 按键排序比较函数。
 * 排序顺序：数字 (0-9) → 字母 (A-Z) → 功能键 (F1-F12) → 其他
 */
function compareSortKey(a: string, b: string): number {
  const aIsNum = /^\d$/.test(a);
  const bIsNum = /^\d$/.test(b);
  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;

  const aIsLetter = /^[A-Za-z]$/.test(a);
  const bIsLetter = /^[A-Za-z]$/.test(b);
  if (aIsLetter && bIsLetter) return a.localeCompare(b);
  if (aIsLetter && !bIsLetter) return -1;
  if (!aIsLetter && bIsLetter) return 1;

  const aIsFn = /^F\d+$/i.test(a);
  const bIsFn = /^F\d+$/i.test(b);
  if (aIsFn && bIsFn) {
    return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
  }
  if (aIsFn) return 1;
  if (bIsFn) return -1;

  return a.localeCompare(b);
}

/**
 * 对 TableRow 数组按键排序。
 */
function sortTableRows(rows: TableRowData[]): TableRowData[] {
  return rows.sort((a, b) => compareSortKey(a.sortKey, b.sortKey));
}

// ──────────────────────────────────────────────
// 绑定筛选与分组
// ──────────────────────────────────────────────

/**
 * 根据 filterMode 和 filterValue 筛选绑定列表。
 */
function filterBindingsForExport(
  bindings: HotkeyBinding[],
  options: ExportOptions
): HotkeyBinding[] {
  switch (options.filterMode) {
    case 'favorites':
      // HotkeyBinding 类型未定义 isFavorite 字段，
      // 若运行时需要此功能，调用方应先预筛选再传入。
      return bindings.filter((b) => (b as unknown as Record<string, unknown>).isFavorite === true);
    case 'profile':
      return bindings.filter((b) => b.profileId === options.filterValue);
    case 'source':
      return bindings.filter((b) => b.bindingSource === options.filterValue);
    case 'all':
    default:
      return bindings;
  }
}

/**
 * 将绑定列表按选中条件分组。
 *
 * - groupBy === 'category'：按 binding.category 分组，无分类的归入 "未分类"
 * - groupBy === 'source'：按 binding.bindingSource 分组，用中文标签
 * - groupBy === 'none'：所有绑定归入 "全部快捷键" 一组
 *
 * @param bindings 已筛选的绑定列表
 * @param options 导出选项
 * @returns 分组名称 → 绑定列表
 */
export function groupBindingsForExport(
  bindings: HotkeyBinding[],
  options: ExportOptions
): Record<string, HotkeyBinding[]> {
  if (options.groupBy === 'none') {
    return { '全部快捷键': [...bindings] };
  }

  const groups: Record<string, HotkeyBinding[]> = {};

  for (const b of bindings) {
    let groupName: string;

    if (options.groupBy === 'category') {
      groupName = b.category || '未分类';
    } else {
      // groupBy === 'source'
      groupName = getBindingSourceChinese(b.bindingSource || '');
    }

    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(b);
  }

  return groups;
}

// ──────────────────────────────────────────────
// 表格行构建
// ──────────────────────────────────────────────

/**
 * 为分组构建表格行数据。
 *
 * 对于 funckey 绑定，先按物理按键（primaryKey）分组，
 * 再用 formatKeyDisplay 合并大小写变体显示。
 * 对于 alias，每个绑定独立成行。
 * 行内按 sortKey 排序（数字→字母→F 键）。
 */
function buildTableRows(
  bindings: HotkeyBinding[],
  options: ExportOptions
): string[][] {
  const rows: TableRowData[] = [];

  // 分离 funckey 和 alias
  const funckeyBindings = bindings.filter((b) => b.type === 'funckey');
  const aliasBindings = bindings.filter((b) => b.type === 'alias');

  // ── 处理 funckey：按物理按键分组 ──
  const physicalKeyMap = new Map<string, HotkeyBinding[]>();
  for (const b of funckeyBindings) {
    const pk = b.primaryKey || b.key || '';
    if (!physicalKeyMap.has(pk)) {
      physicalKeyMap.set(pk, []);
    }
    physicalKeyMap.get(pk)!.push(b);
  }

  for (const [, pkBindings] of physicalKeyMap) {
    const displayKey = formatKeyDisplay(pkBindings);

    // 在同一个物理按键内，按 (command, type) 去重
    const commandGroups = new Map<string, HotkeyBinding>();
    for (const b of pkBindings) {
      const ck = `${b.command}|${b.type}`;
      if (!commandGroups.has(ck)) {
        commandGroups.set(ck, b);
      }
    }

    for (const b of commandGroups.values()) {
      rows.push(rowDataFromBinding(b, displayKey, options));
    }
  }

  // ── 处理 alias：每个独立成行 ──
  for (const b of aliasBindings) {
    rows.push(rowDataFromBinding(b, b.key || '', options));
  }

  // ── 排序 ──
  sortTableRows(rows);

  return rows.map((r) => {
    const cells: string[] = [r.displayKey, r.chineseName, r.command];
    if (options.includeSource) {
      cells.push(r.commandSource || '', r.bindingSource || '');
    }
    if (options.includeLineNumber) {
      cells.push(r.lineNumber?.toString() || '');
    }
    return cells;
  });
}

/**
 * 从单个绑定创建 TableRowData，并设定排序键。
 */
function rowDataFromBinding(
  b: HotkeyBinding,
  displayKey: string,
  _options: ExportOptions
): TableRowData {
  // 排序键：先取 primaryKey，取不到用 key
  const sortKeyBase = b.primaryKey || b.key || '';

  return {
    displayKey,
    type: b.type === 'alias' ? 'A' : 'F',
    command: b.command,
    chineseName: b.chineseName || '',
    commandSource: getCommandSourceChinese(b.commandSource || ''),
    bindingSource: getBindingSourceChinese(b.bindingSource || ''),
    lineNumber: b.lineNumber,
    sortKey: sortKeyBase,
  };
}

// ──────────────────────────────────────────────
// 列头构建
// ──────────────────────────────────────────────

/**
 * 根据选项构建 Markdown/HTML 表头列名数组。
 */
function buildColumnHeaders(options: ExportOptions): string[] {
  const headers = ['快捷键', '中文命令', '原始命令'];
  if (options.includeSource) {
    headers.push('命令来源', '快捷键来源');
  }
  if (options.includeLineNumber) {
    headers.push('行号');
  }
  return headers;
}

// ──────────────────────────────────────────────
// Markdown 生成
// ──────────────────────────────────────────────

/**
 * 生成 Markdown 格式快捷键速查表。
 *
 * - 按 options.groupBy 分组为二级标题
 * - 每个分组渲染为 Markdown 表格
 * - 同一物理按键的大小写变体合并显示（如 "s / S"）
 * - 按 options.includeSource / includeLineNumber 控制列
 *
 * @param bindings 完整绑定列表（未筛选）
 * @param options 完整导出选项
 * @returns Markdown 文本
 */
export function generateMarkdown(
  bindings: HotkeyBinding[],
  options: ExportOptions
): string {
  const filtered = filterBindingsForExport(bindings, options);
  const grouped = groupBindingsForExport(filtered, options);
  const lines: string[] = [];

  // ── 文档头 ──
  lines.push(`# ${options.title}`);
  lines.push('');
  lines.push(`生成日期：${options.date}`);
  lines.push(`快捷键总数：${filtered.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── 表头 ──
  const columns = buildColumnHeaders(options);
  const headerRow = `| ${columns.join(' | ')} |`;
  const separatorRow = `|${columns.map(() => '---').join('|')}|`;

  // ── 分组遍历 ──
  const groupNames = Object.keys(grouped);
  // 未分类 / 未知来源排最后
  const sortedGroupNames = sortGroupNames(groupNames, options.groupBy);

  for (const groupName of sortedGroupNames) {
    const groupBindings = grouped[groupName];
    const rows = buildTableRows(groupBindings, options);

    lines.push(`## ${groupName}`);
    lines.push('');
    lines.push(headerRow);
    lines.push(separatorRow);

    for (const row of rows) {
      lines.push(`| ${row.join(' | ')} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 对分组名称排序：将 "未分类"、"未知来源" 等放在最后。
 */
function sortGroupNames(
  names: string[],
  groupBy: 'category' | 'source' | 'none'
): string[] {
  const tailNames =
    groupBy === 'category' ? ['未分类'] : ['未知来源', '未识别'];

  const heads: string[] = [];
  const tails: string[] = [];

  for (const name of names) {
    if (tailNames.includes(name)) {
      tails.push(name);
    } else {
      heads.push(name);
    }
  }

  heads.sort((a, b) => a.localeCompare(b, 'zh-CN'));
  tails.sort((a, b) => a.localeCompare(b, 'zh-CN'));

  return [...heads, ...tails];
}

// ──────────────────────────────────────────────
// HTML 生成
// ──────────────────────────────────────────────

/** 内嵌 CSS 样式 */
const EXPORT_CSS = `
body {
  font-family: -apple-system, 'Microsoft YaHei', 'PingFang SC', sans-serif;
  max-width: 960px;
  margin: 0 auto;
  padding: 20px;
  color: #333;
  line-height: 1.6;
}
h1 {
  color: #1a1a2e;
  border-bottom: 2px solid #e94560;
  padding-bottom: 8px;
  margin-bottom: 12px;
}
.meta {
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
}
.meta span {
  margin-right: 20px;
}
h2 {
  color: #16213e;
  margin-top: 28px;
  margin-bottom: 8px;
  font-size: 18px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 24px;
  font-size: 14px;
}
th {
  background: #1a1a2e;
  color: white;
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
}
td {
  padding: 6px 12px;
  border-bottom: 1px solid #eee;
}
tr:hover {
  background: #f5f5f5;
}
.tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  vertical-align: middle;
}
.tag-f {
  background: #e3f2fd;
  color: #1565c0;
}
.tag-a {
  background: #f3e5f5;
  color: #7b1fa2;
}
.count {
  color: #999;
  font-size: 13px;
}
.key-display {
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
  font-weight: 600;
  color: #1a1a2e;
}
.empty {
  color: #999;
  text-align: center;
  padding: 40px;
}
@media print {
  body { padding: 0; font-size: 12pt; }
  h1 { font-size: 18pt; }
  h2 { font-size: 14pt; }
  table { font-size: 10pt; }
  tr:hover { background: inherit; }
  th { background: #1a1a2e !important; color: white !important; }
}
@media (max-width: 600px) {
  body { padding: 10px; }
  table { font-size: 12px; }
  th, td { padding: 4px 6px; }
}
`;

/**
 * 生成独立 HTML 页面快捷键速查表。
 *
 * 包含嵌入式 CSS，响应式设计，打印友好。
 *
 * @param bindings 完整绑定列表
 * @param options 完整导出选项
 * @returns 完整 HTML 文本
 */
export function generateHtml(
  bindings: HotkeyBinding[],
  options: ExportOptions
): string {
  const filtered = filterBindingsForExport(bindings, options);
  const grouped = groupBindingsForExport(filtered, options);
  const columns = buildColumnHeaders(options);
  const groupNames = sortGroupNames(Object.keys(grouped), options.groupBy);

  // 构建表格行
  const tablesHtml = groupNames
    .map((groupName) => {
      const groupBindings = grouped[groupName];
      const rows = buildTableRows(groupBindings, options);

      if (rows.length === 0) return '';

      const thead = `<thead><tr>${columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead>`;
      const tbody = rows
        .map((row) => {
          return `<tr>${row.map((cell, ci) => {
            // 首列（快捷键）加 monospace 样式
            const cls = ci === 0 ? ' class="key-display"' : '';
            return `<td${cls}>${escapeHtml(cell)}</td>`;
          }).join('')}</tr>`;
        })
        .join('\n          ');

      return `
      <h2>${escapeHtml(groupName)} <span class="count">(${groupBindings.length})</span></h2>
      <table>
        ${thead}
        <tbody>
          ${tbody}
        </tbody>
      </table>`;
    })
    .join('\n');

  const bodyContent =
    tablesHtml ||
    '<p class="empty">没有符合条件的快捷键绑定。</p>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title || '')}</title>
  <style>${EXPORT_CSS}</style>
</head>
<body>
  <h1>${escapeHtml(options.title || '')}</h1>
  <div class="meta">
    <span>生成日期：${options.date}</span>
    <span>快捷键总数：${filtered.length}</span>
  </div>
  ${bodyContent}
</body>
</html>`;
}

/**
 * HTML 转义（防 XSS）。
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ──────────────────────────────────────────────
// 文件名生成
// ──────────────────────────────────────────────

/**
 * 生成推荐的文件名（不含扩展名）。
 *
 * 格式：ATM_Allegro_快捷键速查表_<日期>
 * - filterMode === 'favorites' → 追加 "_常用"
 * - filterMode === 'profile'   → 追加 "_<方案名>"
 *
 * @param options 导出选项
 * @returns 文件名（不含扩展名）
 */
export function generateExportFilename(options: ExportOptions): string {
  const base = `ATM_Allegro_快捷键速查表_${options.date || ''}`;

  if (options.filterMode === 'favorites') {
    return `${base}_常用`;
  }

  if (options.filterMode === 'profile' && options.filterValue) {
    // 使用 filterValue 作为方案名（已去除非法文件名字符）
    const safeName = options.filterValue.replace(/[\\/:*?"<>|]/g, '_');
    return `${base}_${safeName}`;
  }

  return base;
}

// ──────────────────────────────────────────────
// 默认选项解析
// ──────────────────────────────────────────────

/** 当前日期字符串 YYYY-MM-DD */
function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 合并用户提供的部分选项与默认值，返回完整的 ExportOptions。
 */
function resolveOptions(partial?: Partial<ExportOptions>): ExportOptions {
  return {
    includeCommand: partial?.includeCommand ?? true,
    includeSource: partial?.includeSource ?? false,
    includeLineNumber: partial?.includeLineNumber ?? false,
    groupBy: partial?.groupBy ?? 'category',
    filterMode: partial?.filterMode ?? 'all',
    filterValue: partial?.filterValue,
    title: partial?.title ?? 'Allegro 快捷键速查表',
    date: partial?.date ?? getTodayString(),
  };
}

// ──────────────────────────────────────────────
// 主导出函数
// ──────────────────────────────────────────────

/**
 * 主导出函数。生成 Markdown 和 HTML 格式的快捷键速查表。
 *
 * @param bindings 快捷键绑定列表
 * @param options  部分导出选项（未指定的使用默认值）
 * @returns 包含 Markdown、HTML、文件名和绑定数的导出结果
 */
export function exportHotkeyCheatsheet(
  bindings: HotkeyBinding[],
  options?: Partial<ExportOptions>
): ExportResult {
  const opts = resolveOptions(options);
  const markdown = generateMarkdown(bindings, opts);
  const html = generateHtml(bindings, opts);
  const filename = generateExportFilename(opts);

  return {
    markdown,
    html,
    filename,
    bindingCount: bindings.length,
  };
}
