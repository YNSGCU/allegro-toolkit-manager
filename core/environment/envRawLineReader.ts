/**
 * ATM - env 文件原始行读取模块
 *
 * 从 env 文件中读取指定行及其上下文，用于 UI 展示和编辑预览。
 */
import fs from 'fs';

/** 原始行上下文 */
export interface RawLineContext {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  contextBefore: string[];
  contextAfter: string[];
  fullContent?: string;
  isReference: boolean;
  exists: boolean;
}

/** 带高亮标记的行数据 */
export interface HighlightedLine {
  lineNumber: number;
  content: string;
  isTarget: boolean;
}

/** 高亮读取结果 */
export interface HighlightReadResult {
  lines: HighlightedLine[];
  error?: string;
}

/** 单行复制结果 */
export interface CopyLineResult {
  content: string;
  success: boolean;
  error?: string;
}

/** 文件预览结果 */
export interface PreviewResult {
  lines: string[];
  totalLines: number;
  truncated: boolean;
  error?: string;
}

/**
 * 读取 env 文件的内容并分割为行数组
 * 同时处理 \n 和 \r\n 换行符
 */
function readFileLines(filePath: string): { lines: string[]; fullContent: string } | { error: string } {
  if (!fs.existsSync(filePath)) {
    return { error: '文件不存在: ' + filePath };
  }

  try {
    const fullContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fullContent.split(/\r?\n/);
    return { lines, fullContent };
  } catch (err) {
    return { error: '读取文件失败: ' + (err instanceof Error ? err.message : String(err)) };
  }
}

/**
 * 读取指定行及其上下文
 * @param filePath 文件路径
 * @param lineNumber 行号（从 1 开始）
 * @param isReference 是否为参考 env
 * @returns 行上下文信息，或错误信息
 */
export function readRawLine(
  filePath: string,
  lineNumber: number,
  isReference: boolean = false,
): RawLineContext | { error: string } {
  const result = readFileLines(filePath);
  if ('error' in result) {
    return { error: result.error };
  }

  const { lines, fullContent } = result;

  // 行号从 1 开始
  if (lineNumber < 1 || lineNumber > lines.length) {
    return { error: '行号超出范围' };
  }

  const lineIndex = lineNumber - 1;
  const lineContent = lines[lineIndex];

  // 获取前 5 行上下文（不超过文件开头）
  const contextStart = Math.max(0, lineIndex - 5);
  const contextBefore = lines.slice(contextStart, lineIndex);

  // 获取后 5 行上下文（不超过文件结尾）
  const contextEnd = Math.min(lines.length, lineIndex + 6);
  const contextAfter = lines.slice(lineIndex + 1, contextEnd);

  return {
    filePath,
    lineNumber,
    lineContent,
    contextBefore,
    contextAfter,
    fullContent,
    isReference,
    exists: true,
  };
}

/**
 * 读取指定行及其上下文，并标记目标行
 * @param filePath 文件路径
 * @param lineNumber 目标行号（从 1 开始）
 * @param highlightRange 高亮范围（可选，用于标记多行）
 * @param isReference 是否为参考 env
 * @returns 行列表（每行标记 isTarget），或错误信息
 */
export function readRawLineWithHighlight(
  filePath: string,
  lineNumber: number,
  highlightRange?: { start: number; end: number },
  isReference: boolean = false,
): HighlightReadResult {
  const result = readFileLines(filePath);
  if ('error' in result) {
    return { lines: [], error: result.error };
  }

  const { lines } = result;

  // 行号从 1 开始
  if (lineNumber < 1 || lineNumber > lines.length) {
    return { lines: [], error: '行号超出范围' };
  }

  // 确定高亮范围
  const highlightStart = highlightRange ? Math.max(1, highlightRange.start) : lineNumber;
  const highlightEnd = highlightRange ? Math.min(lines.length, highlightRange.end) : lineNumber;

  // 确定上下文范围（高亮区域前后各扩展 5 行）
  const contextStart = Math.max(0, highlightStart - 1 - 5);
  const contextEnd = Math.min(lines.length, highlightEnd + 5);

  const resultLines: HighlightedLine[] = [];
  for (let i = contextStart; i < contextEnd; i++) {
    const currentLineNumber = i + 1;
    resultLines.push({
      lineNumber: currentLineNumber,
      content: lines[i],
      isTarget: currentLineNumber >= highlightStart && currentLineNumber <= highlightEnd,
    });
  }

  return { lines: resultLines };
}

/**
 * 复制单行内容（用于剪贴板）
 * @param filePath 文件路径
 * @param lineNumber 行号（从 1 开始）
 * @returns 行内容和操作结果
 */
export function copyRawLine(filePath: string, lineNumber: number): CopyLineResult {
  const result = readFileLines(filePath);
  if ('error' in result) {
    return { content: '', success: false, error: result.error };
  }

  const { lines } = result;

  if (lineNumber < 1 || lineNumber > lines.length) {
    return { content: '', success: false, error: '行号超出范围' };
  }

  return {
    content: lines[lineNumber - 1],
    success: true,
  };
}

/**
 * 读取 env 文件预览（前 N 行）
 * @param filePath 文件路径
 * @param maxLines 最大行数，默认 50
 * @returns 预览结果
 */
export function getEnvFilePreview(
  filePath: string,
  maxLines: number = 50,
): PreviewResult {
  const result = readFileLines(filePath);
  if ('error' in result) {
    return { lines: [], totalLines: 0, truncated: false, error: result.error };
  }

  const { lines } = result;
  const totalLines = lines.length;
  const truncated = totalLines > maxLines;
  const previewLines = lines.slice(0, maxLines);

  return {
    lines: previewLines,
    totalLines,
    truncated,
  };
}

/**
 * 格式化原始行为可显示格式
 * @param rawLine 原始行内容
 * @param maxLength 最大长度，默认 120
 * @returns 格式化后的字符串
 */
export function formatRawLineForDisplay(rawLine: string, maxLength: number = 120): string {
  let formatted = rawLine;

  // 显示空白字符
  formatted = formatted.replace(/\t/g, '→');   // Tab → →
  formatted = formatted.replace(/ /g, '·');    // 空格 · (middle dot)

  // 截断过长行
  if (formatted.length > maxLength) {
    formatted = formatted.slice(0, maxLength - 3) + '...';
  }

  return formatted;
}
