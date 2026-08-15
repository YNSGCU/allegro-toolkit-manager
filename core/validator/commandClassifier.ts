/**
 * ATM - 命令分类器（V1.5）
 *
 * 对快捷键命令进行来源识别和分类。
 * 来源识别优先级（从高到低）：
 *   a. 用户手动修正记录 (userCommandOverrides)
 *   b. ATM 命令注册表 (Skill 扫描)
 *   c. 用户 Skill 扫描
 *   d. 公司只读 Skill 扫描
 *   e. Allegro 内置命令字典
 *   f. unknown
 *
 * 如果命令同时命中 Skill 注册表和 Allegro 内置 → ambiguous
 */
import type { DictionaryEntry } from '../dictionary/commandDictionary';
import type { CommandRegistry, CommandEntry } from '../../src/types/skill';
import type { UserCommandOverride } from '../dictionary/userCommandOverrides';
import { loadDefaultReservedKeys, type ReservedKeyDataEntry } from '../dictionary/reservedKeyLoader';

/** 命令来源类型（与前端类型同步） */
export type CommandSource =
  | 'allegro_builtin'
  | 'user_skill'
  | 'company_skill'
  | 'atm_managed_skill'
  | 'ambiguous'
  | 'unknown';

/** 命令分类结果 */
export interface CommandClassification {
  commandName: string;
  chineseName: string;
  category: string;
  description: string;
  source: CommandSource;
  skillName: string | null;
  skillFilePath: string | null;
  skillTier: string | null;
  confidence: 'high' | 'medium' | 'low';
  loadStatus: 'loaded_configured' | 'maybe_unloaded' | 'unknown';
  /** 是否有用户手动修正 */
  isOverridden?: boolean;
  /** 额外提示信息：检测到同名 Skill */
  extraHint?: 'detected_same_name_skill' | null;
  /** 同名的 Skill 名称 */
  sameNameSkill?: string | null;
}

/** 内置命令白名单（唯一权威来源，commandRegistry.ts 从此导入） */
export const ALLEGRO_BUILTIN_COMMANDS = new Set([
  // 标准编辑命令
  'add', 'move', 'copy', 'delete', 'spin', 'mirror', 'rotate', 'slide',
  'change', 'replace', 'text', 'edit', 'pad', 'define', 'assembly',
  'swap', 'align', 'distribute',
  // 视图控制
  'zoom', 'zoom in', 'zoom out', 'zoom fit', 'zoom points', 'zoom center',
  'show', 'show measure', 'show element', 'measure', 'report', 'status', 'grid', 'snap', 'angle',
  'iangle', 'color', 'color layer', 'view', 'window', 'fill', 'pan',
  // 显示控制
  'highlight', 'dehighlight', 'display', 'layer', 'class', 'subclass',
  'opengl', 'shade', 'flash', 'cns',
  'rats', 'unrats', 'rats all', 'unrats all', 'rats net', 'unrats net',
  // 文件操作
  'save', 'saveas', 'open', 'new', 'close', 'export', 'import', 'plot',
  // 选择与编辑
  'select', 'assign', 'temp group', 'property', 'group', 'degroup',
  'clear', 'done', 'cancel', 'ops', 'resume', 'suspend', 'reset',
  'undo', 'redo', 'cut', 'paste', 'clipboard',
  // 放置命令
  'place', 'place manual', 'place autoplace', 'unplace', 'tplace', 'trotate', 'tmirror', 'tmove',
  'component', 'symbol', 'net', 'pin', 'via', 'via array', 'via bar', 'bbvia', 'microvia',
  // 布线命令
  'route', 'route connect', 'route fanout', 'route net', 'route tenting',
  'unroute', 'unroute net', 'wire', 'line', 'arc', 'circle', 'figure',
  'delay', 'delay tune', 'gloss', 'gloss design', 'gloss parameters', 'smooth', 'fanout',
  'stretch', 'vertex', 'add shape', 'shape add', 'shape delete', 'shape edit',
  'add connect', 'add line', 'add arc', 'add shape', 'add text',
  'void', 'void auto', 'void manual', 'void element', 'boundary', 'merge', 'subtract', 'isolate',
  // 高亮/标记
  'hilite', 'dehilite', 'mark',
  // 快照/网格
  'snap pick to', 'ipick_to_gridunit', 'ipick_to_grid', 'gridunit', 'cmgr',
  // 约束管理
  'constraint', 'constraint manager', 'electrical constraint', 'physical constraint',
  'spacing constraint', 'same net spacing',
  'space', 'flow', 'bundle', 'spread', 'auto',
  // 设计参数
  'design parameter', 'user preference', 'cross section', 'xsection', 'material',
  'techfile', 'toolbar', 'worksheet',
  // 工具命令
  'form', 'help', 'set', 'env', 'skill', 'setwindow', 'menu', 'accelerator', 'pop', 'shell',
  'stroke', 'minimize', 'redraw', 'refresh', 'inquiry', 'infom', 'list',
  'get', 'field', 'popup', 'printf',
  // 数据库
  'database check', 'database', 'design rules check', 'drc', 'check drc', 'clear drc',
  // 统计与输出
  'stats', 'manufacture', 'artwork', 'nc drill', 'nc route', 'silkscreen',
  'photo', 'soldermask', 'paste', 'drill', 'detail', 'surface',
  // 测试准备
  'testprep', 'testprep manual', 'add testpin',
  // 分析
  'analysis', 'si simulation', 'outline', 'create detail',
  // 尺寸标注
  'dimension', 'dimension polar', 'dimension linear', 'dimension diametral', 'dimension angular',
  // 列表/标签
  'label', 'padstack',
  // 网络操作
  'net group', 'net list', 'net logic', 'profile', 'project', 'project manager',
  'extract', 'filter', 'context', 'options', 'visibility', 'logfile', 'echo', 'axl',
  'find', 'script', 'update', 'update symbols', 'quick check', 'quick measure', 'quick show',
  // 子绘图
  'subdrawing', 'record', 'replay',
  // 测试
  'add_testpin', 'testprep', 'testprep manual',
  // 综合
  'test', 'tool', 'segment', 'type', 'surface',
]);

/** 归一化命令名 */
function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/^["']|["']$/g, '').replace(/[;]$/, '');
}

/** 命令归一化：去掉引号、分号、前后空格，取第一个词 */
export function normalizeCommand(raw: string): string {
  return normalize(raw).split(/\s+/)[0];
}

/** 解析完整命令文本 */
export function parseFullCommand(raw: string): string {
  return normalize(raw);
}

/**
 * 新的来源识别函数（V1.6 修正优先级）
 *
 * 优先级（从高到低）：
 *   a. 用户手动修正记录 (最高)
 *   b. Allegro 内置命令白名单（move/copy/slide 等 → 不标记为歧义）
 *   c. ATM 命令注册表（Skill 扫描）
 *   d. unknown
 *
 * 注意：Allegro 内置命令具有高优先级，即使 Skill 注册表也有同名函数，
 * 仍优先判定为内置。用户可通过手动修正覆盖此判定。
 */
export function classifySourceV2(
  commandName: string,
  registry: CommandRegistry | null,
  userOverrides?: Record<string, UserCommandOverride> | null,
): {
  source: CommandSource;
  skillName: string | null;
  skillFilePath: string | null;
  skillTier: string | null;
  isOverridden: boolean;
  extraHint?: 'detected_same_name_skill' | null;
  sameNameSkill?: string | null;
} {
  const lower = commandName.toLowerCase();

  // a. 用户手动修正记录（最高优先级）
  if (userOverrides) {
    const override = userOverrides[lower];
    if (override) {
      return {
        source: override.source as CommandSource,
        skillName: override.skillName || null,
        skillFilePath: null,
        skillTier: null,
        isOverridden: true,
      };
    }
  }

  // b. 检查是否为 Allegro 内置命令（优先于 Skill 注册表）
  //    move/copy/slide/delete 等标准命令即使 Skill 也有同名函数，仍视为内置
  const isBuiltin = ALLEGRO_BUILTIN_COMMANDS.has(lower) || ALLEGRO_BUILTIN_COMMANDS.has(lower.split(/\s+/)[0]);
  if (isBuiltin) {
    // 检查注册表中是否有同名 Skill 函数（用于 extraHint 提示）
    let sameNameSkill: string | null = null;
    if (registry) {
      const registryEntry = registry.entries[lower] || registry.entries[lower.split(/\s+/)[0]];
      if (registryEntry && registryEntry.length > 0) {
        sameNameSkill = registryEntry[0].skillName;
      }
    }
    return {
      source: 'allegro_builtin', skillName: null, skillFilePath: null, skillTier: null,
      isOverridden: false,
      extraHint: sameNameSkill ? 'detected_same_name_skill' : null,
      sameNameSkill,
    };
  }

  // c. 命令注册表中查找（Skill 扫描结果）
  if (registry) {
    let registryMatch: CommandEntry | null = null;
    if (registry.entries[lower] && registry.entries[lower].length > 0) {
      registryMatch = registry.entries[lower][0];
    }
    if (!registryMatch) {
      const firstWord = lower.split(/\s+/)[0];
      if (registry.entries[firstWord] && registry.entries[firstWord].length > 0) {
        registryMatch = registry.entries[firstWord][0];
      }
    }
    if (registryMatch) {
      const sourceMap: Record<string, CommandSource> = {
        user: 'user_skill',
        atm: 'atm_managed_skill',
        company: 'company_skill',
      };
      return {
        source: sourceMap[registryMatch.tier] || 'unknown',
        skillName: registryMatch.skillName,
        skillFilePath: registryMatch.skillFilePath,
        skillTier: registryMatch.tier,
        isOverridden: false,
      };
    }
  }

  // d. unknown
  return { source: 'unknown', skillName: null, skillFilePath: null, skillTier: null, isOverridden: false };
}

/**
 * 检查 Skill 的加载状态
 */
export function checkLoadStatus(
  skillName: string | null,
  source: CommandSource,
  loaderContent?: string,
  ilinitContent?: string,
): 'loaded_configured' | 'maybe_unloaded' | 'unknown' {
  if (source === 'allegro_builtin' || source === 'unknown') return 'loaded_configured';
  if (!skillName) return 'unknown';

  if (loaderContent) {
    const pat1 = new RegExp(`load\\([^)]*${escapeRegExp(skillName)}\\.(il|cls)`, 'i');
    const pat2 = new RegExp(`load\\([^)]*${escapeRegExp(skillName)}['"\\)]`, 'i');
    if (pat1.test(loaderContent) || pat2.test(loaderContent)) return 'loaded_configured';
  }

  if (ilinitContent) {
    const pat1 = new RegExp(`load\\([^)]*${escapeRegExp(skillName)}\\.(il|cls)`, 'i');
    if (pat1.test(ilinitContent)) return 'loaded_configured';
  }

  if (loaderContent || ilinitContent) return 'maybe_unloaded';
  return 'unknown';
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 评估识别可信度
 */
export function evaluateConfidence(source: CommandSource, hasDictionary: boolean): 'high' | 'medium' | 'low' {
  if (source === 'ambiguous') return 'low';
  if (source === 'allegro_builtin') return 'high';
  if (source === 'unknown') return 'low';
  return hasDictionary ? 'high' : 'medium';
}

/**
 * 完整的命令分类（V1.5 优先级链）
 */
export function classifyCommand(
  rawCommand: string,
  dictionaries: Record<string, DictionaryEntry>[],
  registry: CommandRegistry | null,
  userOverrides?: Record<string, UserCommandOverride> | null,
  loadContext?: {
    baseDir?: string | null;
    loaderContent?: string;
    ilinitContent?: string;
  },
): CommandClassification {
  const fullCommand = parseFullCommand(rawCommand);
  const firstWord = normalizeCommand(rawCommand);

  // 1. 中文名查询（字典 → 回退原始命令）
  let chineseName: string = firstWord;
  let category: string = '';
  let description: string = '';
  let hasDict = false;

  for (const name of [fullCommand, firstWord]) {
    const found = lookupInDict(dictionaries, name);
    if (found) {
      chineseName = found.chineseName;
      category = found.category;
      description = found.description;
      if (found.defaultSource === 'allegro_builtin') hasDict = true;
      break;
    }
  }

  // 2. 来源识别（V1.5 优先级链）
  const { source, skillName, skillFilePath, skillTier, isOverridden, extraHint, sameNameSkill } = classifySourceV2(
    firstWord,
    registry,
    userOverrides || null,
  );

  // 3. 可信度
  const confidence = evaluateConfidence(source, hasDict);

  // 4. 加载状态
  const loadStatus = checkLoadStatus(
    skillName,
    source,
    loadContext?.loaderContent,
    loadContext?.ilinitContent,
  );

  return {
    commandName: fullCommand,
    chineseName: chineseName || firstWord,
    category,
    description,
    source,
    skillName,
    skillFilePath,
    skillTier,
    confidence,
    loadStatus,
    isOverridden: isOverridden || undefined,
    extraHint: extraHint || null,
    sameNameSkill: sameNameSkill || null,
  };
}

/** 字典查找 */
function lookupInDict(
  dictionaries: Record<string, DictionaryEntry>[],
  commandName: string,
): DictionaryEntry | undefined {
  const key = normalize(commandName);
  for (const dict of dictionaries) {
    if (dict[key]) return dict[key];
  }
  return undefined;
}

/**
 * 加载默认保留键（V2.2：从 data/default_reserved_keys.json 加载）
 */
export function loadReservedKeys(): Record<string, {
  chineseName: string;
  defaultCommand: string;
  source: string;
  description: string;
}> {
  try {
    const result = loadDefaultReservedKeys();
    if (!result.success) return {};
    const record: Record<string, { chineseName: string; defaultCommand: string; source: string; description: string }> = {};
    for (const entry of result.data) {
      record[entry.rawKey] = {
        chineseName: entry.zhName,
        defaultCommand: entry.command,
        source: entry.bindingSource,
        description: entry.zhName,
      };
    }
    return record;
  } catch {
    // 单条记录解析失败时跳过，不影响批量分类结果
  }
  return {};
}

/**
 * 检查是否为软件保留键（F3 等）
 */
export function isSoftwareDefaultKey(key: string, reservedKeys?: Record<string, any>): boolean {
  if (!reservedKeys) {
    try { reservedKeys = loadReservedKeys(); } catch { return false; }
  }
  const lower = key.toLowerCase();
  for (const [rk] of Object.entries(reservedKeys)) {
    if (rk.toLowerCase() === lower) return true;
  }
  return false;
}
