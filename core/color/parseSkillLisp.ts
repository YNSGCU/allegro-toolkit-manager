/**
 * ATM - SKILL LISP 字面量解析器
 *
 * Vibe Bridge 使用 SKILL 的 %L 格式化输出返回结果（例如
 * `((nil class "ETCH" visible t ...))`）。该模块将这些输出
 * 解析为 TypeScript 原生数组/布尔/数字/字符串结构。
 *
 * 支持语法：嵌套括号列表、双引号字符串（含转义）、
 * 数字、符号 t / nil、其他符号（保留为字符串）。
 */

export type LispValue =
  | number
  | string
  | boolean
  | null
  | LispValue[];

/** 将 SKILL %L 输出解析为 TypeScript 结构 */
export function parseSkillLisp(input: string): LispValue {
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    return null;
  }
  const parser = new Parser(tokens);
  const result = parser.parseValue();
  if (!parser.isEnd()) {
    throw new Error(`LISP 解析错误: 位置 ${parser.position} 存在多余内容 "${tokens[parser.position]}"`);
  }
  return result;
}

type Token = '(' | ')' | string;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const length = input.length;

  while (i < length) {
    const ch = input[i];

    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i += 1;
      continue;
    }

    if (ch === '"') {
      // 字符串字面量：处理转义
      let j = i + 1;
      let value = '';
      while (j < length) {
        const c = input[j];
        if (c === '\\' && j + 1 < length) {
          const next = input[j + 1];
          if (next === 'n') value += '\n';
          else if (next === 't') value += '\t';
          else if (next === 'r') value += '\r';
          else value += next;
          j += 2;
          continue;
        }
        if (c === '"') {
          j += 1;
          break;
        }
        value += c;
        j += 1;
      }
      tokens.push(value);
      i = j;
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i += 1;
      continue;
    }

    // 普通 token：读到空白或括号为止
    let j = i;
    while (j < length && input[j] !== ' ' && input[j] !== '\t' && input[j] !== '\r' && input[j] !== '\n' && input[j] !== '(' && input[j] !== ')') {
      j += 1;
    }
    tokens.push(input.slice(i, j));
    i = j;
  }

  return tokens;
}

class Parser {
  position = 0;

  constructor(private readonly tokens: Token[]) {}

  isEnd(): boolean {
    return this.position >= this.tokens.length;
  }

  parseValue(): LispValue {
    if (this.isEnd()) {
      throw new Error('LISP 解析错误: 意外结束');
    }

    const token = this.tokens[this.position];

    if (token === '(') {
      return this.parseList();
    }

    if (token === ')') {
      throw new Error('LISP 解析错误: 多余的右括号');
    }

    this.position += 1;
    return parseAtom(token);
  }

  private parseList(): LispValue[] {
    this.position += 1; // 跳过 (
    const items: LispValue[] = [];

    while (!this.isEnd() && this.tokens[this.position] !== ')') {
      items.push(this.parseValue());
    }

    if (this.isEnd()) {
      throw new Error('LISP 解析错误: 缺少右括号');
    }

    this.position += 1; // 跳过 )
    return items;
  }
}

function parseAtom(token: string): LispValue {
  if (token === 't') return true;
  if (token === 'nil') return null;

  // 数字（含负数和浮点）
  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }

  return token;
}
