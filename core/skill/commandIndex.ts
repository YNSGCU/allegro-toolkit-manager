/**
 * ATM - CommandIndex 命令索引（V5.1）
 * V5.4：移除冗余调试日志，使用统一 debug 模块
 *
 * 集中索引所有已知命令（Skill 入口命令 + Allegro 内置命令），
 * 用于将 HotkeyBinding 与 Skill 命令自动关联。
 *
 * 使用方式：
 *   const idx = new CommandIndex();
 *   idx.build(skills);
 *   const match = idx.find("snp");
 *   const enriched = idx.classifyBinding(binding);
 */
import { ALLEGRO_BUILTIN_COMMANDS } from '../validator/commandClassifier';
import type { SkillFileItem, CommandIndexItem, SkillCommandItem } from '../../src/types/skill';
import type { HotkeyBinding } from '../../src/types/hotkey';
import { debugLogIf } from '../debug';

// ═══════════════════════════════════════════════════
// 类型导出
// ═══════════════════════════════════════════════════

export interface MatchResult {
  /** 原始命令文本 */
  commandName: string;
  /** 归一化后的完整命令 */
  normalized: string;
  /** 基础命令（取第一个词） */
  baseCommand: string;
  /** 所有匹配的索引条目 */
  matches: CommandIndexItem[];
  /** 是否有多条匹配（歧义） */
  isAmbiguous: boolean;
  /** 最佳匹配（优先级最高的唯一条目，null 表示无匹配） */
  bestMatch: CommandIndexItem | null;
}

// ═══════════════════════════════════════════════════
// 归一化工具函数
// ═══════════════════════════════════════════════════

/** 归一化命令文本：去引号、去分号、去空格、转小写 */
export function normalizeCommand(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '').replace(/[;]$/, '').trim().toLowerCase();
}

/** 提取基础命令（第一个词）："snp arg1" → "snp" */
export function extractBaseCommand(raw: string): string {
  return normalizeCommand(raw).split(/\s+/)[0];
}

// ═══════════════════════════════════════════════════
// CommandIndex
// ═══════════════════════════════════════════════════

export class CommandIndex {
  /** 归一化命令名 → CommandIndexItem[]（数组支持歧义） */
  private items: Map<string, CommandIndexItem[]> = new Map();
  /** skillId → CommandIndexItem[]（反向查找用） */
  private bySkillId: Map<string, CommandIndexItem[]> = new Map();
  /** 是否已 build */
  private _built = false;

  /** 是否已构建 */
  get built(): boolean {
    return this._built;
  }

  /** 索引中总命令数 */
  get size(): number {
    return this.items.size;
  }

  /**
   * 从 SkillFileItem[] 构建索引
   */
  build(skills: SkillFileItem[]): void {
    this.items.clear();
    this.bySkillId.clear();

    // 1. 遍历所有 Skill 的入口命令
    for (const skill of skills) {
      const skillItems: CommandIndexItem[] = [];

      for (const cmd of skill.entryCommands) {
        const normalized = cmd.name.toLowerCase().trim();
        const item: CommandIndexItem = {
          commandName: cmd.name,
          normalizedCommandName: normalized,
          sourceType: skill.sourceType,
          sourceSkillId: skill.id,
          sourceSkillName: skill.name,
          sourceFile: skill.path,
          entryType: cmd.commandKind === 'axl_registered'
            ? 'axlCmdRegister'
            : cmd.commandKind === 'procedure'
              ? 'procedure'
              : cmd.commandKind === 'defun'
                ? 'defun'
                : 'manual',
          confidence: cmd.confidence,
          handlerFunction: cmd.handlerFunction,
        };

        skillItems.push(item);

        const existing = this.items.get(normalized);
        if (existing) {
          // 去重：同一个 Skill 的同名命令只保留一条
          if (!existing.some((e) => e.sourceSkillId === skill.id)) {
            existing.push(item);
          }
        } else {
          this.items.set(normalized, [item]);
        }
      }

      this.bySkillId.set(skill.id, skillItems);
    }

    // 2. 加入 Allegro 内置命令
    for (const cmdName of ALLEGRO_BUILTIN_COMMANDS) {
      const normalized = normalizeCommand(cmdName);
      const item: CommandIndexItem = {
        commandName: cmdName,
        normalizedCommandName: normalized,
        sourceType: 'allegro_builtin',
        entryType: 'manual',
        confidence: 'high',
      };

      const existing = this.items.get(normalized);
      if (existing) {
        // 如果 Skill 已注册同名命令，不覆盖，也不重复加 builtin
        if (!existing.some((e) => e.sourceType === 'allegro_builtin')) {
          existing.push(item);
        }
      } else {
        this.items.set(normalized, [item]);
      }
    }

    this._built = true;
  }

  /**
   * 查找命令
   * @param rawCommand 原始命令文本
   */
  find(rawCommand: string): MatchResult {
    const commandName = rawCommand.trim();
    const normalized = normalizeCommand(commandName);
    const baseCommand = extractBaseCommand(commandName);

    // 优先：归一化精确匹配
    if (this.items.has(normalized)) {
      const matches = this.items.get(normalized)!;
      return {
        commandName,
        normalized,
        baseCommand,
        matches,
        isAmbiguous: matches.length > 1,
        bestMatch: pickBestMatch(matches),
      };
    }

    // 次优：基础命令匹配（"snp arg1" → "snp"）
    if (baseCommand !== normalized && this.items.has(baseCommand)) {
      const matches = this.items.get(baseCommand)!;
      return {
        commandName,
        normalized,
        baseCommand,
        matches,
        isAmbiguous: matches.length > 1,
        bestMatch: pickBestMatch(matches),
      };
    }

    // 最后：前缀匹配
    const prefixMatches: CommandIndexItem[] = [];
    for (const [key, items] of this.items) {
      if (key.startsWith(baseCommand) || baseCommand.startsWith(key)) {
        prefixMatches.push(...items);
      }
    }
    if (prefixMatches.length > 0) {
      return {
        commandName,
        normalized,
        baseCommand,
        matches: prefixMatches,
        isAmbiguous: prefixMatches.length > 1,
        bestMatch: pickBestMatch(prefixMatches),
      };
    }

    // 无匹配
    return {
      commandName,
      normalized,
      baseCommand,
      matches: [],
      isAmbiguous: false,
      bestMatch: null,
    };
  }

  /**
   * 分类单个绑定：填充 commandSource/skillName/skillFilePath 等字段
   */
  classifyBinding(binding: HotkeyBinding): Partial<HotkeyBinding> {
    const match = this.find(binding.command);

    if (!match.bestMatch) {
      return {
        commandSource: 'unknown',
        skillName: null,
        skillFilePath: null,
        skillTier: null,
        confidence: 'low' as const,
        loadStatus: 'unknown' as const,
        sameNameSkill: null,
      };
    }

    if (match.isAmbiguous) {
      return {
        commandSource: 'ambiguous',
        skillName: match.bestMatch.sourceSkillName || null,
        skillFilePath: match.bestMatch.sourceFile || null,
        skillTier: mapTier(match.bestMatch.sourceType),
        confidence: 'medium' as const,
        loadStatus: 'unknown' as const,
        sameNameSkill: null,
      };
    }

    const bm = match.bestMatch;
    const source = bm.sourceType === 'allegro_builtin' ? 'allegro_builtin' : bm.sourceType;

    return {
      commandSource: source as any,
      skillName: bm.sourceSkillName || null,
      skillFilePath: bm.sourceFile || null,
      skillTier: mapTier(bm.sourceType),
      confidence: bm.confidence,
      loadStatus: 'unknown' as const,
      sameNameSkill: null,
    };
  }

  /**
   * 批量分类绑定
   */
  classifyBindings(bindings: HotkeyBinding[]): HotkeyBinding[] {
    return bindings.map((b) => ({
      ...b,
      ...this.classifyBinding(b),
    }));
  }

  /**
   * 查询某个 Skill 的所有索引命令
   */
  findBySkillId(skillId: string): CommandIndexItem[] {
    return this.bySkillId.get(skillId) || [];
  }

  /**
   * 检查命令名是否存在
   */
  hasCommand(name: string): boolean {
    const normalized = normalizeCommand(name);
    return this.items.has(normalized) || this.items.has(extractBaseCommand(name));
  }

  /**
   * 检查命令是否存在但 Skill 已被删除/不可用
   */
  isCommandOrphaned(name: string): boolean {
    const match = this.find(name);
    if (!match.bestMatch) return false;
    // 如果 bestMatch 有 sourceSkillId 但 bySkillId 中已无该 Skill 条目，视为 orphaned
    if (match.bestMatch.sourceSkillId && this.bySkillId.has(match.bestMatch.sourceSkillId)) {
      return false;
    }
    return match.bestMatch.sourceType !== 'allegro_builtin';
  }
}

// ═══════════════════════════════════════════════════
// 内部辅助
// ═══════════════════════════════════════════════════

/** 从多条匹配中选出最佳（优先级：axlCmdRegister > procedure > defun > manual；同类取第一个） */
function pickBestMatch(matches: CommandIndexItem[]): CommandIndexItem | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const priority: Record<string, number> = {
    axlCmdRegister: 4,
    procedure: 3,
    defun: 2,
    manual: 1,
  };

  let best = matches[0];
  let bestScore = priority[best.entryType] || 0;

  for (let i = 1; i < matches.length; i++) {
    const score = priority[matches[i].entryType] || 0;
    if (score > bestScore) {
      best = matches[i];
      bestScore = score;
    }
  }

  return best;
}

/** 将 CommandIndexItem.sourceType 映射为 skillTier 字符串 */
function mapTier(sourceType: string): string | null {
  switch (sourceType) {
    case 'user_skill': return 'user';
    case 'company_skill': return 'company';
    case 'atm_managed_skill': return 'atm';
    case 'allegro_builtin': return null;
    default: return null;
  }
}
