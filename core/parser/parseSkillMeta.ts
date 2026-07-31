/**
 * ATM - Skill 元数据解析模块
 * 解析 .il / .ile / .cls 文件中的 procedure、defun、defunValue 定义，
 * 以及 axlCmdRegister 注册的命令，并区分入口命令与内部函数。
 */
import fs from 'fs';
import type {
  SkillFunction,
  SkillFunctionType,
  SkillFunctionItem,
  SkillParseResult,
  ConfidenceLevel,
  HotkeyReference,
} from '../../src/types/skill';
import { ENTRY_COMMAND_PATTERNS, INTERNAL_FUNCTION_PATTERNS } from '../../src/types/skill';

// ════════════════════════════════════════════════════════════
// 正则模式
// ════════════════════════════════════════════════════════════

interface FunctionPattern {
  regex: RegExp;
  type: SkillFunctionType;
}

/** 函数定义正则 */
const FUNCTION_PATTERNS: FunctionPattern[] = [
  { regex: /^\s*procedure\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/i, type: 'procedure' },
  { regex: /^\s*\(\s*procedure\s+([A-Za-z_][A-Za-z0-9_]*)/i, type: 'procedure' },
  { regex: /^\s*defun\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/i, type: 'defun' },
  { regex: /^\s*\(\s*defun\s+([A-Za-z_][A-Za-z0-9_]*)/i, type: 'defun' },
  { regex: /^\s*defunValue\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/i, type: 'defunValue' },
  { regex: /^\s*\(\s*defunValue\s+([A-Za-z_][A-Za-z0-9_]*)/i, type: 'defunValue' },
];

/** axlCmdRegister 正则 — 同时捕获命令名和处理函数
 *  格式1 (C风格): axlCmdRegister("cmdName" 'handlerFunc)
 *  格式2 (C风格): axlCmdRegister("cmdName" "handlerFunc")
 *  格式3 (S表达式): (axlCmdRegister "cmdName" 'handlerFunc)
 *  格式4 (S表达式): (axlCmdRegister "cmdName" "handlerFunc")
 *  Group 1: 命令名（"snp"）
 *  Group 2: 处理函数（'handler 形式，不含引号）
 *  Group 3: 处理函数（"handler" 形式，不含引号）
 */
const AXL_CMD_REGISTER_REGEX =
  /axlCmdRegister[\s(]+"([^"]+)"[\s,]*(?:'([a-zA-Z_][a-zA-Z0-9_]*)|"([^"]+)")?/gi;

/** axlCmdRegister 注册信息 — 命令名与处理函数的映射 */
export interface AxlCmdRegistration {
  /** 外部可调用命令名，如 "snp" */
  commandName: string;
  /** 实际执行的处理函数名，如 "ssnap_native_run"（可能为空） */
  handlerFunction?: string;
  /** 在文件中的行号 */
  lineNumber: number;
}

/** 注释中的 @command 和 @description 标记 */
const ANNOTATION_COMMAND_REGEX = /;\s*@command\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
const ANNOTATION_DESCRIPTION_REGEX = /;\s*@description\s+(.+)/gi;
const DIRECT_FUNCKEY_REGEX = /axlSetFunckey\(\s*"([^"]+)"\s+(.+?)\)\s*;?/i;
const DIRECT_ALIAS_REGEX = /axlSetAlias\(\s*"([^"]+)"\s+(.+?)\)\s*;?/i;

// ════════════════════════════════════════════════════════════
// 核心解析函数
// ════════════════════════════════════════════════════════════

/**
 * 从 SKILL 文件内容中提取所有函数定义
 */
export function extractProcedureDefun(content: string): SkillFunction[] {
  const functions: SkillFunction[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith(';') || trimmed === '') continue;

    for (const { regex, type } of FUNCTION_PATTERNS) {
      const match = trimmed.match(regex);
      if (match) {
        const name = match[1];
        if (!functions.some((f) => f.name === name && f.type === type)) {
          functions.push({ name, type, lineNumber: i + 1 });
        }
        break;
      }
    }
  }

  return functions;
}

/**
 * 从内容中提取所有 axlCmdRegister 注册的命令名（旧版 — 仅命令名列表）
 */
export function extractAxlRegisteredCommands(content: string): string[] {
  return extractAxlCmdRegistrations(content).map(r => r.commandName);
}

/**
 * 从内容中提取所有 axlCmdRegister 注册信息（命令名 + 处理函数）
 * 格式: axlCmdRegister("cmdName" 'handlerFunc) 或 axlCmdRegister("cmdName" "handlerFunc")
 */
export function extractAxlCmdRegistrations(content: string): AxlCmdRegistration[] {
  const registrations: AxlCmdRegistration[] = [];
  const seen = new Set<string>();
  const lines = content.split(/\r?\n/);
  // 重新用逐行搜索以获取准确行号
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    AXL_CMD_REGISTER_REGEX.lastIndex = 0; // 重置
    let match: RegExpExecArray | null;
    while ((match = AXL_CMD_REGISTER_REGEX.exec(line)) !== null) {
      const cmdName = match[1].trim();
      if (!cmdName) continue;
      const key = cmdName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // 处理函数：group2 = 'handler 形式, group3 = "handler" 形式
      const handler = match[2] || match[3] || undefined;
      registrations.push({
        commandName: cmdName,
        handlerFunction: handler ? handler.trim() : undefined,
        lineNumber: i + 1,
      });
    }
  }
  return registrations;
}

/**
 * 提取注释中的 @command 标记
 */
export function extractCommandAnnotations(content: string): Map<string, string> {
  const annotations = new Map<string, string>();
  let match: RegExpExecArray | null;
  while ((match = ANNOTATION_COMMAND_REGEX.exec(content)) !== null) {
    const cmd = match[1].trim();
    if (cmd) {
      // 查找下一行是否有 @description
      const rest = content.slice(match.index);
      const descMatch = rest.match(ANNOTATION_DESCRIPTION_REGEX);
      annotations.set(cmd.toLowerCase(), descMatch ? descMatch[1].trim() : '');
    }
  }
  return annotations;
}

function extractCommandExpression(rawExpression: string): string {
  const trimmed = rawExpression.trim();
  const quoted = trimmed.match(/^"([^"]*)"/);
  if (quoted) {
    return quoted[1];
  }

  return trimmed.replace(/\)\s*;?\s*$/, '').trim();
}

export function extractDirectHotkeyRefs(content: string, filePath: string = ''): HotkeyReference[] {
  const refs: HotkeyReference[] = [];
  const seen = new Set<string>();
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith(';')) {
      continue;
    }

    const funckeyMatch = line.match(DIRECT_FUNCKEY_REGEX);
    if (funckeyMatch) {
      const key = funckeyMatch[1].trim();
      const command = extractCommandExpression(funckeyMatch[2]);
      const dedupeKey = `funckey:${key.toLowerCase()}:${command.toLowerCase()}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        refs.push({
          key,
          command,
          type: 'funckey',
          source: filePath,
          lineNumber: i + 1,
          sourceType: 'skill_direct',
        });
      }
      continue;
    }

    const aliasMatch = line.match(DIRECT_ALIAS_REGEX);
    if (aliasMatch) {
      const key = aliasMatch[1].trim();
      const command = extractCommandExpression(aliasMatch[2]);
      const dedupeKey = `alias:${key.toLowerCase()}:${command.toLowerCase()}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        refs.push({
          key,
          command,
          type: 'alias',
          source: filePath,
          lineNumber: i + 1,
          sourceType: 'skill_direct',
        });
      }
    }
  }

  return refs;
}

/**
 * 判断函数名是否匹配入口命令启发式模式
 */
function matchesEntryPattern(name: string): { match: boolean; pattern: string } {
  for (const pattern of ENTRY_COMMAND_PATTERNS) {
    if (name.endsWith(pattern) || name === pattern) {
      return { match: true, pattern };
    }
  }
  return { match: false, pattern: '' };
}

/**
 * 判断函数名是否匹配内部函数启发式模式
 */
function matchesInternalPattern(name: string): { match: boolean; pattern: string } {
  for (const pattern of INTERNAL_FUNCTION_PATTERNS) {
    if (name.startsWith(pattern) || name.endsWith(pattern) || name.includes(pattern)) {
      return { match: true, pattern };
    }
  }
  return { match: false, pattern: '' };
}

/**
 * 增强解析 - 区分入口命令和内部函数
 *
 * 入口命令优先级：
 * 1. axlCmdRegister(...) 注册的命令
 * 2. 函数命名像入口（_main, _run, _start, _cmd, Action 结尾等）
 * 3. 剩余未分类的为内部函数
 * 4. 如果函数数量很少（<=3），所有函数都可以被视为入口命令
 *
 * @param content SKILL 文件内容
 * @param filePath 文件路径（仅用于错误报告）
 * @returns 增强解析结果
 */
export function enhancedParseSkill(content: string, filePath?: string): {
  functions: SkillFunction[];
  enhancedFunctions: SkillFunctionItem[];
  axlRegisteredCommands: string[];
  registrations: AxlCmdRegistration[];
  annotations: Map<string, string>;
  directHotkeyRefs: HotkeyReference[];
} {
  const functions = extractProcedureDefun(content);
  const registrations = extractAxlCmdRegistrations(content);
  const axlRegisteredCommands = registrations.map(r => r.commandName);
  const annotations = extractCommandAnnotations(content);
  const directHotkeyRefs = extractDirectHotkeyRefs(content, filePath);

  // 构建 axl 注册命令的 set（小写）
  const axlSet = new Set(axlRegisteredCommands.map((c) => c.toLowerCase()));

  // 增强函数列表
  const enhancedFunctions: SkillFunctionItem[] = [];

  for (const func of functions) {
    const nameLower = func.name.toLowerCase();
    let isEntry = false;
    let isAxlRegistered = false;
    let confidence: ConfidenceLevel = 'low';
    let reason = '';

    // 规则 1: axlCmdRegister 注册
    if (axlSet.has(nameLower) || axlSet.has(func.name)) {
      isEntry = true;
      isAxlRegistered = true;
      confidence = 'high';
      reason = '通过 axlCmdRegister 注册为 Allegro 命令';
    }
    // 规则 2: 匹配入口命名模式
    else {
      const entryMatch = matchesEntryPattern(func.name);
      if (entryMatch.match) {
        isEntry = true;
        confidence = 'medium';
        reason = `命名模式匹配入口命令（${entryMatch.pattern}）`;
      }
    }

    // 如果还不是入口，检查是否匹配内部函数模式
    if (!isEntry) {
      const internalMatch = matchesInternalPattern(func.name);
      if (internalMatch.match) {
        isEntry = false;
        confidence = 'medium';
        reason = `命名模式匹配内部函数（${internalMatch.pattern}）`;
      }
    }

    // 如果仍然未知，检查是否是 axl 注册命令的变体或辅助函数
    if (!isEntry && confidence === 'low') {
      // 检查是否有 axl 注册命令包含此函数名作为子串（可能是辅助函数）
      for (const axlCmd of axlRegisteredCommands) {
        const axlLower = axlCmd.toLowerCase();
        // 如果函数名是 axl 注册命令的子串或反过来
        if (nameLower.includes(axlLower) || axlLower.includes(nameLower)) {
          if (nameLower !== axlLower) {
            isEntry = false;
            confidence = 'low';
            reason = `可能是 ${axlCmd} 的辅助函数`;
            break;
          }
        }
      }
    }

    // 如果还没有判定，默认不是入口
    if (!isEntry && confidence === 'low') {
      isEntry = false;
      confidence = 'low';
      reason = '未被识别为入口命令，归类为内部函数';
    }

    // 特殊情况：如果文件中的函数很少（<=3），标记所有 axl 注册以外的函数为可能的入口
    // （在小文件中，大多数函数都是可调用的）
    if (!isEntry && functions.length <= 3 && confidence === 'low') {
      isEntry = true;
      confidence = 'medium';
      reason = 'Skill 文件函数较少，可能是可直接调用的函数';
    }

    enhancedFunctions.push({
      name: func.name,
      type: func.type,
      lineNumber: func.lineNumber,
      isEntry,
      isAxlRegistered,
      confidence,
      reason,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // axlCmdRegister 条目增强：将注册的外部命令名作为独立入口
  // 当 axlCmdRegister("snp" 'ssnap_native_run) 时：
  //   - "snp" → 外部命令名，作为入口命令
  //   - ssnap_native_run → 处理函数，标记为内部（除非已被其他规则标记为入口）
  // ═══════════════════════════════════════════════════════════
  for (const reg of registrations) {
    const cmdLower = reg.commandName.toLowerCase();
    // 检查是否已有同名函数被标记为入口（axlCmdRegister("my_cmd" 'my_cmd) 的情况）
    const existingFunc = enhancedFunctions.find(f => f.name.toLowerCase() === cmdLower);
    if (existingFunc) {
      // 已有同名的 procedure/defun，确保它被正确标记为 axl 注册入口
      if (!existingFunc.isEntry) {
        existingFunc.isEntry = true;
        existingFunc.isAxlRegistered = true;
        existingFunc.confidence = 'high';
        existingFunc.reason = `通过 axlCmdRegister 注册为 Allegro 命令（命令名: ${reg.commandName}）`;
      }
      continue;
    }

    // 命令名与函数名不同（如 "snp" → ssnap_native_run）
    // 添加 axlCmdRegister 的外部命令名作为入口条目
    enhancedFunctions.push({
      name: reg.commandName,        // 外部命令名 "snp"
      type: 'procedure' as SkillFunctionType, // axlCmdRegister 对外表现为可调用命令
      lineNumber: reg.lineNumber,
      isEntry: true,
      isAxlRegistered: true,
      confidence: 'high',
      reason: `通过 axlCmdRegister 注册为 Allegro 命令（处理函数: ${reg.handlerFunction || '未知'}）`,
      commandName: reg.commandName,
      handlerFunction: reg.handlerFunction,
    });

    // 将对应的处理函数从入口降为内部（如果之前被标记为入口）
    if (reg.handlerFunction) {
      const handlerLower = reg.handlerFunction.toLowerCase();
      const handlerFunc = enhancedFunctions.find(f => f.name.toLowerCase() === handlerLower);
      if (handlerFunc && handlerFunc.isEntry && !handlerFunc.isAxlRegistered) {
        // 处理函数之前被启发式标记为入口但现在知道它只是 axlCmdRegister 的处理函数
        handlerFunc.isEntry = false;
        handlerFunc.confidence = 'high';
        handlerFunc.reason = `作为 axlCmdRegister("${reg.commandName}") 的处理函数，非独立入口`;
      }
    }
  }

  // 没有 axl 注册且没有匹配入口模式的文件：至少将第一个函数作为入口（常见于简单工具）
  if (enhancedFunctions.length > 0 && !enhancedFunctions.some((f) => f.isEntry)) {
    // 将第一个函数标记为入口（低的置信度）
    enhancedFunctions[0].isEntry = true;
    enhancedFunctions[0].confidence = 'low';
    enhancedFunctions[0].reason = '文件中的第一个函数，作为默认入口命令';
  }

  return {
    functions,
    enhancedFunctions,
    axlRegisteredCommands,
    registrations,
    annotations,
    directHotkeyRefs,
  };
}

/**
 * 读取并解析单个 SKILL 文件（增强版）
 */
export function parseSkillFile(filePath: string): SkillParseResult {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        filePath,
        functions: [],
        error: `文件不存在: ${filePath}`,
      };
    }

    const content = fs.readFileSync(filePath, { encoding: 'utf-8' });

    // 基础解析
    const functions = extractProcedureDefun(content);

    // 增强解析
    const {
      enhancedFunctions,
      axlRegisteredCommands,
      registrations,
      directHotkeyRefs,
    } = enhancedParseSkill(content, filePath);

    const entryCount = enhancedFunctions.filter((f) => f.isEntry).length;
    const internalCount = enhancedFunctions.filter((f) => !f.isEntry).length;

    return {
      filePath,
      functions,
      enhancedFunctions,
      axlRegistrations: registrations,
      directHotkeyRefs,
      parseDetail: {
        entryCount,
        internalCount,
        axlRegistered: axlRegisteredCommands,
        heuristicEntry: enhancedFunctions
          .filter((f) => f.isEntry && !f.isAxlRegistered)
          .map((f) => f.name),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      filePath,
      functions: [],
      error: `读取 Skill 文件失败: ${message}`,
    };
  }
}

/**
 * 检查文件名是否为 Skill 文件
 */
export function isSkillFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.il') || lower.endsWith('.ile') || lower.endsWith('.cls');
}
