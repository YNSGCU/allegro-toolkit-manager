/**
 * ATM - funckey 解析模块
 * 解析 env 文件中的 funckey 行
 */
import type { EnvEntry } from '../../src/types/hotkey';

/**
 * 解析 funckey 行
 * 格式: funckey <key> <command>
 * 支持: 行尾注释 (; 或 #)、多余空格
 * @param line 原始行内容（已去除换行符）
 * @param lineNumber 行号（从 1 开始）
 * @returns 解析后的 EnvEntry，如果不是 funckey 行则返回 null
 */
export function parseFunckey(line: string, lineNumber: number): EnvEntry | null {
  const trimmed = line.trim();

  // 必须以 funckey 开头（大小写敏感，但兼容首字母大写）
  if (!/^\s*funckey\s/i.test(line)) {
    return null;
  }

  // 去除行尾注释（; 或 #），但注意字符串中的 ; 和 # 不属于注释
  // 简单策略：找到第一个不在引号中的 ; 或 # 作为注释起点
  const strippedLine = stripTrailingComment(trimmed);

  // 匹配: funckey <key> [command]
  // key: 非空白字符序列
  // command: 剩余部分（可能为空）
  const match = strippedLine.match(/^funckey\s+(\S+)(?:\s+(.*))?$/i);

  if (!match) {
    // funckey 关键字存在但格式异常
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
    type: 'funckey',
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
 * @param line 输入行
 * @returns 去除注释后的行
 */
function stripTrailingComment(line: string): string {
  let inQuote: string | null = null;
  let commentStart = -1;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuote) {
      // 在引号中，只有匹配的结束引号可以退出
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

/**
 * 检查按键是否为系统保留键
 * @param key 按键名
 * @returns 是否为保留键
 */
export function isReservedKey(key: string): boolean {
  const reservedPatterns = [
    /^Alt\+F4$/i,
    /^Ctrl\+Alt\+Del$/i,
    /^Ctrl\+Shift\+Esc$/i,
    /^Alt\+Tab$/i,
    /^Ctrl\+Esc$/i,
    /^Alt\+Space$/i,
    /^Win$/i,
    /^Pause$/i,
    /^Break$/i,
  ];

  return reservedPatterns.some((pattern) => pattern.test(key));
}
