/**
 * ATM - Skill 使用状态总览（V5.2）
 * V5.4：修复 findReferencingBindings 未使用 CommandIndex 的缺陷
 *
 * 为每个 Skill 计算综合使用状态、健康度评分、使用关系树。
 *
 * 使用方式：
 *   const statusInfo = computeUsageStatus(skill, allSkills, bindings);
 *   const health = computeHealthScore(skill, allSkills);
 */
import { CommandIndex, normalizeCommand } from './commandIndex';
import type {
  SkillFileItem,
  SkillUsageStatus,
  SkillUsageInfo,
  HealthDeduction,
  SkillConfigFile,
  UsageTreeNode,
  HotkeyReference,
  MenuReference,
  SkillCommandItem,
  SkillTier,
  SkillLoadStatus,
  SkillParseStatus,
} from '../../src/types/skill';
import type { HotkeyBinding } from '../../src/types/hotkey';

// ═══════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════

/** 提取命令的基础形式 */
function baseCommandName(cmd: string): string {
  return cmd.trim().replace(/^["']|["']$/g, '').replace(/[;]$/, '').trim().split(/\s+/)[0];
}

// ═══════════════════════════════════════════════════
// 综合使用状态计算
// ═══════════════════════════════════════════════════

/**
 * 计算单个 Skill 的综合使用状态
 */
export function computeUsageStatus(
  skill: SkillFileItem,
  allSkills: SkillFileItem[],
  allBindings: HotkeyBinding[],
  commandIndex?: CommandIndex,
): SkillUsageInfo {
  const reasons: string[] = [];
  const deductions: HealthDeduction[] = [];

  // 1. 检查是否为只读/公司
  if (skill.readonly || skill.tier === 'company') {
    reasons.push('公司/只读 Skill，仅作参考');
    deductions.push({ reason: '只读 Skill', points: 0 });
    return {
      status: 'readonly_reference',
      reasons,
      healthScore: 70,
      healthDeductions: deductions,
    };
  }

  // 2. 检查文件是否存在
  if (skill.parseStatus === 'error' && skill.parseError?.includes('not found') ||
      skill.parseError?.includes('不存在') || skill.parseError?.includes('ENOENT')) {
    reasons.push('Skill 文件不存在');
    deductions.push({ reason: '文件不存在', points: 100 });
    return {
      status: 'missing_file',
      reasons,
      healthScore: 0,
      healthDeductions: deductions,
    };
  }

  // 3. 检查解析状态
  if (skill.parseStatus === 'error') {
    reasons.push('Skill 解析失败');
    deductions.push({ reason: '解析失败', points: 20 });
    // 仍然可以查看引用，但不标记为 available
  }

  // 4. 检查启用/禁用
  if (!skill.enabled) {
    reasons.push('Skill 已禁用');
    deductions.push({ reason: '已禁用', points: 30 });
    return {
      status: 'disabled',
      reasons: ['Skill 已禁用，暂无影响'],
      healthScore: 40,
      healthDeductions: deductions,
    };
  }

  // 5. 检查加载状态
  const isLoaded = skill.loadStatus === 'loaded_configured';
  const hasReferencingBindings = findReferencingBindings(skill, allBindings, commandIndex);

  if (!isLoaded && hasReferencingBindings.length > 0) {
    reasons.push(`有 ${hasReferencingBindings.length} 个快捷键引用，但未配置加载`);
    deductions.push({ reason: '有引用但未加载', points: 20 });
    return {
      status: 'referenced_but_not_loaded',
      reasons,
      healthScore: 50,
      healthDeductions: deductions,
    };
  }

  // 6. 检查命令冲突
  const conflicts = findCommandConflicts(skill, allSkills);
  if (conflicts.length > 0) {
    reasons.push(`命令冲突: ${conflicts.join(', ')}`);
    deductions.push({ reason: `命令冲突: ${conflicts.join(', ')}`, points: 30 });
    return {
      status: 'command_conflict',
      reasons,
      healthScore: 40,
      healthDeductions: deductions,
    };
  }

  // 7. 解析错误
  if (skill.parseStatus === 'error') {
    reasons.push('Skill 文件解析失败');
    deductions.push({ reason: '解析失败', points: 20 });
    return {
      status: 'parse_error',
      reasons,
      healthScore: 30,
      healthDeductions: deductions,
    };
  }

  // 8. 有引用且已加载 → available
  if (isLoaded && hasReferencingBindings.length > 0) {
    const keyList = hasReferencingBindings.map(r => r.key).join(', ');
    reasons.push(`已启用、已加载，命令被快捷键 ${keyList} 引用`);
    return {
      status: 'available',
      reasons,
      healthScore: computeRawHealthScore(skill, allSkills, deductions),
      healthDeductions: deductions,
    };
  }

  // 9. 可用但无引用
  if (isLoaded && hasReferencingBindings.length === 0) {
    reasons.push('Skill 可用，但无快捷键或菜单引用');
    deductions.push({ reason: '无快捷键/菜单引用', points: 10 });
    if (skill.menuRefs.length === 0) {
      deductions.push({ reason: '无菜单入口', points: 5 });
    }
    return {
      status: 'available_unreferenced',
      reasons,
      healthScore: computeRawHealthScore(skill, allSkills, deductions),
      healthDeductions: deductions,
    };
  }

  // 10. 加载状态未知或未加载
  reasons.push('加载状态未知');
  deductions.push({ reason: '加载状态未知', points: 10 });
  return {
    status: 'referenced_but_not_loaded',
    reasons,
    healthScore: 50,
    healthDeductions: deductions,
  };
}

/**
 * 批量计算所有 Skill 的使用状态
 */
export function computeAllUsageStatuses(
  allSkills: SkillFileItem[],
  allBindings: HotkeyBinding[],
): Map<string, SkillUsageInfo> {
  const idx = new CommandIndex();
  idx.build(allSkills);
  const result = new Map<string, SkillUsageInfo>();
  for (const skill of allSkills) {
    result.set(skill.id, computeUsageStatus(skill, allSkills, allBindings, idx));
  }
  return result;
}

// ═══════════════════════════════════════════════════
// 健康度评分
// ═══════════════════════════════════════════════════

/**
 * 计算健康度得分（0-100）
 */
function computeRawHealthScore(
  skill: SkillFileItem,
  allSkills: SkillFileItem[],
  deductions: HealthDeduction[],
): number {
  let score = 100;

  // 已扣过的分不再重复扣
  const deductionMap = new Map<string, number>();
  for (const d of deductions) {
    deductionMap.set(d.reason, d.points);
  }

  // 无中文说明/备注
  if (!deductionMap.has('无中文说明') && !skill.hasPackageJson) {
    // This would ideally check skillMeta, but we don't have it here
    // So we do a lighter check — if entryCommands have no zhName
    const hasZhName = skill.entryCommands.some(c => c.zhName);
    if (!hasZhName) {
      deductions.push({ reason: '没有中文说明或备注', points: 10 });
      score -= 10;
    }
  }

  // 配置文件缺失（简化检查）
  if (skill.hasPackageJson) {
    // 有 package.json 不需要额外配置文件
  }

  // 无菜单入口
  if (skill.menuRefs.length === 0 && skill.entryCommands.length > 0) {
    deductions.push({ reason: '没有菜单入口', points: 5 });
    score -= 5;
  }

  // 内部函数过多（代码复杂度）
  const ratio = skill.internalFunctions.length / Math.max(skill.totalFunctionCount, 1);
  if (ratio < 0.1 && skill.totalFunctionCount > 5) {
    deductions.push({ reason: '入口命令占比异常', points: 5 });
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 计算 Skill 的健康度评分
 */
export function computeHealthScore(
  skill: SkillFileItem,
  allSkills: SkillFileItem[],
): { score: number; deductions: HealthDeduction[] } {
  const deductions: HealthDeduction[] = [];

  // 核心扣分
  if (!skill.enabled) {
    deductions.push({ reason: '已禁用', points: 30 });
  } else if (skill.loadStatus !== 'loaded_configured') {
    deductions.push({ reason: '未发现加载配置', points: 20 });
  }

  // 命令重名
  const conflicts = findCommandConflicts(skill, allSkills);
  if (conflicts.length > 0) {
    deductions.push({ reason: `命令重名: ${conflicts.join(', ')}`, points: 30 });
  }

  // 快捷键引用失效
  if (skill.hotkeyRefs.length === 0 && skill.enabled && skill.entryCommands.length > 0) {
    deductions.push({ reason: '无快捷键引用', points: 10 });
  }

  // 解析失败
  if (skill.parseStatus === 'error') {
    deductions.push({ reason: '解析失败', points: 20 });
  }

  // 无中文说明
  const hasZhName = skill.entryCommands.some(c => c.zhName);
  if (!hasZhName) {
    deductions.push({ reason: '没有中文说明或备注', points: 10 });
  }

  // 无菜单入口
  if (skill.menuRefs.length === 0 && skill.entryCommands.length > 0) {
    deductions.push({ reason: '没有菜单入口', points: 5 });
  }

  // 配置文件缺失（如果有 package.json 则跳过）
  if (!skill.hasPackageJson) {
    // 简化: 没有 package.json 不视为扣分项
  }

  let score = 100 - deductions.reduce((sum, d) => sum + d.points, 0);
  score = Math.max(0, Math.min(100, score));

  return { score, deductions };
}

// ═══════════════════════════════════════════════════
// 使用关系树
// ═══════════════════════════════════════════════════

/**
 * 构建单个 Skill 的使用关系树节点
 */
export function buildUsageTree(
  skill: SkillFileItem,
  allBindings: HotkeyBinding[],
  commandIndex?: CommandIndex,
): UsageTreeNode {
  const root: UsageTreeNode = {
    name: skill.name,
    type: 'skill',
    path: skill.path,
    children: [],
  };

  // 为每个入口命令构建子树
  for (const cmd of skill.entryCommands) {
    const cmdChildren: UsageTreeNode[] = [];

    // 查找引用此命令的快捷键
    const refBindings = findBindingsForCommand(cmd.name, allBindings, commandIndex);
    if (refBindings.length > 0) {
      for (const b of refBindings) {
        cmdChildren.push({
          name: b.key,
          type: 'hotkey',
          detail: `${b.type} → ${b.command}`,
          source: b.source || b.envSourceId,
          lineNumber: b.lineNumber,
          isLoaded: skill.loadStatus === 'loaded_configured',
          hasConflict: b.status === 'duplicate' || b.status === 'prefix_conflict',
          isStale: b.status === 'missing_command',
        });
      }
    }

    // 查找菜单引用
    const refMenus = skill.menuRefs.filter(m => m.command === cmd.name);
    if (refMenus.length > 0) {
      for (const m of refMenus) {
        cmdChildren.push({
          name: m.path,
          type: 'menu',
          detail: m.command,
          source: m.source,
        });
      }
    }

    // 无引用
    if (cmdChildren.length === 0) {
      cmdChildren.push({
        name: '暂无快捷键或菜单调用',
        type: 'empty',
      });
    }

    const cmdNode: UsageTreeNode = {
      name: cmd.name,
      type: 'command',
      detail: cmd.commandKind,
      loadStatus: cmd.loadStatus,
      conflictStatus: cmd.conflictStatus,
      children: cmdChildren,
    };
    root.children!.push(cmdNode);
  }

  // 如果没有任何入口命令
  if (skill.entryCommands.length === 0) {
    root.children!.push({
      name: '未检测到入口命令',
      type: 'empty',
    });
  }

  return root;
}

// ═══════════════════════════════════════════════════
// 未使用 Skill 检测
// ═══════════════════════════════════════════════════

/**
 * 检测未使用的 Skill
 * 规则：
 *   1. 无快捷键引用
 *   2. 无菜单引用
 *   3. 无 loader 加载
 *   4. 或者已加载但无任何快捷键/菜单引用
 */
export function findUnusedSkills(
  allSkills: SkillFileItem[],
  allBindings: HotkeyBinding[],
): SkillFileItem[] {
  const unused: SkillFileItem[] = [];

  for (const skill of allSkills) {
    if (skill.readonly || skill.tier === 'company') continue; // 跳过只读

    const hasHotkeyRef = findReferencingBindings(skill, allBindings).length > 0;
    const hasMenuRef = skill.menuRefs.length > 0;
    const isLoaded = skill.loadStatus === 'loaded_configured' || skill.enabled;

    // 没有任何引用
    if (!hasHotkeyRef && !hasMenuRef) {
      unused.push(skill);
    }
    // 已加载但没有任何快捷键/菜单引用
    else if (isLoaded && !hasHotkeyRef && !hasMenuRef) {
      unused.push(skill);
    }
  }

  return unused;
}

// ═══════════════════════════════════════════════════
// 配置文件扫描
// ═══════════════════════════════════════════════════

/**
 * 扫描 Skill 目录中的配置文件
 */
export function scanConfigFiles(skillDir: string, skillName: string): SkillConfigFile[] {
  const fs = require('fs');
  const path = require('path');
  const configFiles: SkillConfigFile[] = [];

  if (!skillDir || !fs.existsSync(skillDir)) return configFiles;

  const baseName = path.parse(skillName).name;
  const extensions = ['.json', '.cfg', '.ini', '.txt', '.yaml', '.yml', '.conf'];
  const commonNames = [
    `${baseName}.json`,
    `${baseName}.cfg`,
    `${baseName}.ini`,
    `${baseName}.txt`,
    `${baseName}.yaml`,
    `${baseName}.yml`,
    `${baseName}.conf`,
    'config.json',
    'package.json',
  ];

  for (const name of commonNames) {
    const fullPath = path.join(skillDir, name);
    const exists = fs.existsSync(fullPath);
    if (exists) {
      try {
        const stat = fs.statSync(fullPath);
        configFiles.push({
          fileName: name,
          filePath: fullPath,
          exists: true,
          isReadonly: false,
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
        });
      } catch {
        configFiles.push({
          fileName: name,
          filePath: fullPath,
          exists: true,
          isReadonly: false,
        });
      }
    }
  }

  return configFiles;
}

/**
 * 生成使用说明 README
 */
export function generateReadme(
  skill: SkillFileItem,
  meta?: { displayName?: string; autoSummary?: string; autoName?: string },
): string {
  const lines: string[] = [];
  const title = meta?.displayName || meta?.autoName || skill.name;

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`文件：${skill.name}`);
  lines.push('');
  lines.push(`路径：${skill.path}`);
  lines.push('');

  if (meta?.autoSummary) {
    lines.push(`## 用途`);
    lines.push('');
    lines.push(meta.autoSummary);
    lines.push('');
  }

  lines.push(`## 入口命令`);
  lines.push('');
  for (const cmd of skill.entryCommands) {
    const hotkeys = cmd.hotkeys.length > 0 ? cmd.hotkeys.join(', ') : '无';
    lines.push(`- ${cmd.name}（${cmd.commandKind}）`);
    lines.push(`  - 快捷键：${hotkeys}`);
    const menus = skill.menuRefs.filter(m => m.command === cmd.name);
    if (menus.length > 0) {
      for (const m of menus) {
        lines.push(`  - 菜单：${m.path}`);
      }
    } else {
      lines.push(`  - 菜单：未发现`);
    }
  }
  lines.push('');

  lines.push(`## 加载状态`);
  lines.push('');
  const loadMap: Record<string, string> = {
    loaded_configured: '已配置加载',
    enabled_but_not_loaded: '已启用但可能未加载',
    disabled: '已禁用',
    readonly_reference: '只读参考',
    unknown: '未知',
    maybe_unloaded: '可能未加载',
  };
  lines.push(`${loadMap[skill.loadStatus] || skill.loadStatus}`);
  lines.push('');

  if (skill.hotkeyRefs.length > 0) {
    lines.push(`## 快捷键`);
    lines.push('');
    for (const ref of skill.hotkeyRefs) {
      lines.push(`- ${ref.key} → ${ref.command}（${ref.type}）`);
    }
    lines.push('');
  }

  lines.push(`## 内部函数`);
  lines.push(`共 ${skill.internalFunctions.length} 个内部函数`);
  if (skill.internalFunctions.length > 0) {
    for (const fn of skill.internalFunctions.slice(0, 20)) {
      lines.push(`- ${fn.name}（${fn.type}）`);
    }
    if (skill.internalFunctions.length > 20) {
      lines.push(`- ... 还有 ${skill.internalFunctions.length - 20} 个`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push(`*由 ATM (Allegro Toolkit Manager) 于 ${new Date().toLocaleString('zh-CN')} 自动生成*`);

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════
// 内部辅助函数
// ═══════════════════════════════════════════════════

/**
 * 查找引用指定 Skill 命令的快捷键绑定
 * V5.4：修复未使用 CommandIndex 的缺陷 — 现在通过 CommandIndex 匹配命令名，
 * 确保 axlCmdRegister 注册的外部命令名（如 "snp"）能正确匹配。
 */
function findReferencingBindings(
  skill: SkillFileItem,
  bindings: HotkeyBinding[],
  commandIndex?: CommandIndex,
): HotkeyBinding[] {
  const entryNames = new Set(skill.entryCommands.map(c => c.name.toLowerCase()));
  // 额外收集 handlerFunction 名（axlCmdRegister 的处理函数也参与匹配）
  const handlerNames = new Set(
    skill.entryCommands.filter(c => c.handlerFunction).map(c => c.handlerFunction!.toLowerCase())
  );
  const result: HotkeyBinding[] = [];

  for (const b of bindings) {
    const cmdBase = baseCommandName(b.command).toLowerCase();

    // 1. 直接名称匹配
    if (entryNames.has(cmdBase) || handlerNames.has(cmdBase)) {
      result.push(b);
      continue;
    }

    // 2. 使用 CommandIndex 匹配（关键：解决 axlCmdRegister 外部命令名匹配）
    if (commandIndex) {
      const match = commandIndex.find(b.command);
      if (match.bestMatch && match.bestMatch.sourceSkillId === skill.id) {
        result.push(b);
        continue;
      }
    }

    // 3. 退而求其次：如果 binding 已由 enrichBindings 填充了 skillName
    if (b.skillName && b.skillName.toLowerCase() === skill.name.toLowerCase()) {
      result.push(b);
    }
  }

  return result;
}

/**
 * 查找引用指定命令的快捷键绑定
 * V5.4：增加 CommandIndex 匹配以处理 axlCmdRegister 外部命令名
 */
function findBindingsForCommand(
  commandName: string,
  bindings: HotkeyBinding[],
  commandIndex?: CommandIndex,
): HotkeyBinding[] {
  const normalized = normalizeCommand(commandName);

  // 先尝试直接匹配
  const directMatches = bindings.filter(b => {
    const cmdBase = baseCommandName(b.command).toLowerCase();
    return cmdBase === normalized;
  });
  if (directMatches.length > 0) return directMatches;

  // 再尝试用 CommandIndex 匹配（处理 axlCmdRegister 命令名≠函数名的情况）
  if (commandIndex) {
    return bindings.filter(b => {
      const match = commandIndex.find(b.command);
      return match.bestMatch && match.bestMatch.normalizedCommandName === normalized;
    });
  }

  return [];
}

/**
 * 查找与指定 Skill 有同名命令冲突的 Skill
 */
function findCommandConflicts(skill: SkillFileItem, allSkills: SkillFileItem[]): string[] {
  const conflicts: string[] = [];
  const skillEntryNames = new Set(skill.entryCommands.map(c => c.name.toLowerCase()));

  for (const other of allSkills) {
    if (other.id === skill.id || other.tier === 'company') continue;
    for (const cmd of other.entryCommands) {
      const name = cmd.name.toLowerCase();
      if (skillEntryNames.has(name)) {
        if (!conflicts.includes(name)) {
          conflicts.push(name);
        }
      }
    }
  }

  return conflicts;
}
