/**
 * ATM - env 文件解析模块
 * 解析完整的 env 文件，识别 funckey、alias、ATM 托管块等
 */
import { parseFunckey } from './parseFunckey';
import { parseAlias } from './parseAlias';
import {
  ATM_MANAGED_BLOCK_START,
  ATM_MANAGED_BLOCK_END,
} from '../../src/types/hotkey';
import type { EnvEntry, ParseEnvResult } from '../../src/types/hotkey';

/**
 * 解析完整的 env 文件内容
 * @param content env 文件完整内容
 * @returns ParseEnvResult
 */
export function parseEnv(content: string): ParseEnvResult {
  const entries: EnvEntry[] = [];
  const warnings: string[] = [];
  let hasManagedBlock = false;
  let managedBlockRange: { startLine: number; endLine: number } | undefined;
  let insideManagedBlock = false;
  let managedBlockStartLine = 0;

  // 按行分割。空字符串返回空数组
  const rawLines = content === '' ? [] : content.split(/\r?\n/);
  // 去掉末尾空行（文件以换行结尾时 split 会多出一个空元素）
  const lines = rawLines.length > 1 && rawLines[rawLines.length - 1] === ''
    ? rawLines.slice(0, -1)
    : rawLines;
  // 记录行号从 1 开始
  let currentSource: 'user_original' | 'atm_managed' = 'user_original';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;

    // 检测 ATM 托管块开始标记
    if (rawLine.trim() === ATM_MANAGED_BLOCK_START) {
      hasManagedBlock = true;
      insideManagedBlock = true;
      managedBlockStartLine = lineNumber;
      currentSource = 'atm_managed';

      entries.push({
        type: 'comment',
        raw: rawLine,
        lineNumber,
        source: 'atm_managed',
      });
      continue;
    }

    // 检测 ATM 托管块结束标记
    if (rawLine.trim() === ATM_MANAGED_BLOCK_END) {
      insideManagedBlock = false;
      currentSource = 'user_original';
      managedBlockRange = {
        startLine: managedBlockStartLine,
        endLine: lineNumber,
      };

      entries.push({
        type: 'comment',
        raw: rawLine,
        lineNumber,
        source: 'atm_managed',
      });
      continue;
    }

    // 空行
    if (rawLine.trim() === '') {
      entries.push({
        type: 'blank',
        raw: rawLine,
        lineNumber,
        source: insideManagedBlock ? 'atm_managed' : 'user_original',
      });
      continue;
    }

    // 纯注释行（非 ATM 标记的注释行）
    if (/^\s*[;#]/.test(rawLine)) {
      entries.push({
        type: 'comment',
        raw: rawLine,
        lineNumber,
        source: currentSource,
      });
      continue;
    }

    // 尝试解析 funckey
    const funckeyEntry = parseFunckey(rawLine, lineNumber);
    if (funckeyEntry) {
      funckeyEntry.source = currentSource;
      entries.push(funckeyEntry);
      continue;
    }

    // 尝试解析 alias
    const aliasEntry = parseAlias(rawLine, lineNumber);
    if (aliasEntry) {
      aliasEntry.source = currentSource;
      entries.push(aliasEntry);
      continue;
    }

    // 无法解析的行，作为 raw 保留
    entries.push({
      type: 'raw',
      raw: rawLine,
      lineNumber,
      source: currentSource,
    });
  }

  // 如果文件结束了但 ATM 块未闭合
  if (insideManagedBlock) {
    warnings.push(`ATM 托管块未正确闭合（开始于第 ${managedBlockStartLine} 行，文件结束未找到结束标记）`);
    // 仍然标记这些行
    managedBlockRange = {
      startLine: managedBlockStartLine,
      endLine: lines.length,
    };
  }

  return {
    entries,
    warnings,
    hasManagedBlock,
    managedBlockRange,
  };
}

/**
 * 读取并解析 env 文件
 * @param filePath env 文件路径
 * @returns 解析结果
 */
export async function parseEnvFile(filePath: string): Promise<ParseEnvResult> {
  const fs = await import('fs');
  const path = await import('path');

  try {
    const normalizedPath = path.normalize(filePath);
    const content = fs.readFileSync(normalizedPath, { encoding: 'utf-8' });
    return parseEnv(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      entries: [],
      warnings: [`读取文件失败: ${message}`],
      hasManagedBlock: false,
    };
  }
}
