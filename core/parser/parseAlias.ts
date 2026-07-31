/**
 * ATM - alias 解析模块
 * 解析 env 文件中的 alias 行
 */
import type { EnvEntry } from '../../src/types/hotkey';

/**
 * 解析 alias 行
 * 格式: alias <name> <command>
 * 支持: 行尾注释 (; 或 #)、多余空格
 * @param line 原始行内容（已去除换行符）
 * @param lineNumber 行号（从 1 开始）
 * @returns 解析后的 EnvEntry，如果不是 alias 行则返回 null
 */
export function parseAlias(line: string, lineNumber: number): EnvEntry | null {
  const trimmed = line.trim();

  // 必须以 alias 开头（大小写不敏感）
  if (!/^\s*alias\s/i.test(line)) {
    return null;
  }

  // 去除行尾注释
  const strippedLine = stripTrailingComment(trimmed);

  // 匹配: alias <name> [command]
  // name: 非空白字符序列
  // command: 剩余部分（可能为空）
  const match = strippedLine.match(/^alias\s+(\S+)(?:\s+(.*))?$/i);

  if (!match) {
    // alias 关键字存在但格式异常
    return {
      type: 'raw',
      raw: line,
      lineNumber,
      source: 'user_original',
    };
  }

  const key = match[1];
  const command = match[2]?.trim() || '';

  return {
    type: 'alias',
    key,
    command,
    raw: line,
    lineNumber,
    source: 'user_original',
  };
}

/**
 * 去除行尾注释
 * 处理 ; 和 # 作为注释标记，但忽略引号内的字符
 */
function stripTrailingComment(line: string): string {
  let inQuote: string | null = null;
  let commentStart = -1;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      }
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ';' || ch === '#') {
        commentStart = i;
        break;
      }
    }
  }

  if (commentStart >= 0) {
    return line.substring(0, commentStart).trimEnd();
  }

  return line;
}
