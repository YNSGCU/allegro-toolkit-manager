/**
 * ATM - Skill 影响分析（V5.1）
 *
 * 分析删除/禁用 Skill 的影响：哪些快捷键会失效，有哪些菜单引用。
 * 同时提供失效引用检测（Skill 被外部删除后 env 中的残留引用）。
 */
import { CommandIndex } from './commandIndex';
import type {
  SkillFileItem,
  HotkeyReference,
  MenuReference,
  ImpactAnalysis,
  ImpactOptionAction,
  ImpactOption,
  SkillReferenceIssue,
  StaleRefInfo,
  SkillApplyPlan,
  SkillApplyStep,
  SkillTier,
} from '../../src/types/skill';
import type { HotkeyBinding } from '../../src/types/hotkey';
import type { EnvironmentInfo } from '../../src/types/environment';

/**
 * 分析删除/禁用 Skill 的影响
 * @param targetSkill 目标 Skill
 * @param allSkills 所有 Skill 列表
 * @param allBindings 所有快捷键绑定
 * @param commandIndex 命令索引（若提供则直接使用，否则新建）
 */
export function analyzeSkillDeleteImpact(
  targetSkill: SkillFileItem,
  allSkills: SkillFileItem[],
  allBindings: HotkeyBinding[],
  commandIndex?: CommandIndex,
): ImpactAnalysis {
  const idx = commandIndex || (() => {
    const i = new CommandIndex();
    i.build(allSkills);
    return i;
  })();

  const isReadonly = targetSkill.readonly || targetSkill.tier === 'company';

  // 1. 构建快捷键引用列表
  const hotkeyRefs: HotkeyReference[] = [];
  const entryCmdNames = new Set(targetSkill.entryCommands.map((c) => c.name.toLowerCase()));

  for (const binding of allBindings) {
    const match = idx.find(binding.command);
    const matchedSkillId = match.bestMatch?.sourceSkillId;

    // 匹配条件：binding 关联到此 Skill
    let isMatch = false;
    if (matchedSkillId === targetSkill.id) {
      isMatch = true;
    } else if (binding.skillName && binding.skillName.toLowerCase() === targetSkill.name.toLowerCase()) {
      isMatch = true;
    } else {
      // 用命令名匹配
      const cmdBase = binding.command.trim().split(/\s+/)[0]
        .replace(/^["']|["']$/g, '').replace(/[;]$/, '').toLowerCase();
      if (entryCmdNames.has(cmdBase)) {
        isMatch = true;
      }
    }

    if (isMatch) {
      hotkeyRefs.push({
        key: binding.key,
        command: binding.command,
        type: binding.type as 'funckey' | 'alias',
        source: binding.source || binding.envSourceId || '',
        lineNumber: binding.lineNumber || 0,
      });
    }
  }

  // 2. 菜单引用（当前未实现完整菜单扫描，用 targetSkill.menuRefs）
  const menuRefs: MenuReference[] = [...targetSkill.menuRefs];

  // 3. 生成 issue
  const issues: SkillReferenceIssue[] = [];
  if (hotkeyRefs.length > 0 || menuRefs.length > 0) {
    issues.push({
      id: `delete-impact-${targetSkill.id}`,
      severity: hotkeyRefs.length > 0 ? 'error' : 'warning',
      type: 'skill_delete_has_refs',
      title: `Skill "${targetSkill.name}" 仍有引用`,
      description: hotkeyRefs.length > 0
        ? `检测到 ${hotkeyRefs.length} 个快捷键引用${menuRefs.length > 0 ? `、${menuRefs.length} 个菜单引用` : ''}`
        : `检测到 ${menuRefs.length} 个菜单引用`,
      skillId: targetSkill.id,
      suggestedActions: ['查看引用详情', '禁用而非删除', '先解除所有引用'],
    });
  }

  // 4. 构造操作选项
  const options = generateDeleteOptions(targetSkill, hotkeyRefs.length, menuRefs.length);

  return {
    skillId: targetSkill.id,
    skillName: targetSkill.name,
    tier: targetSkill.tier,
    canDelete: !isReadonly,
    isReadonly,
    totalRefs: hotkeyRefs.length + menuRefs.length,
    hotkeyRefs,
    menuRefs,
    issues,
    options,
  };
}

/**
 * 根据引用情况生成操作选项
 */
function generateDeleteOptions(
  targetSkill: SkillFileItem,
  hotkeyRefCount: number,
  menuRefCount: number,
): ImpactOption[] {
  const options: ImpactOption[] = [];

  // 取消 — 总是可用
  options.push({
    action: 'cancel',
    label: '取消操作',
    description: '不做任何更改，返回',
    riskLevel: 'safe',
    steps: [],
  });

  // 仅禁用加载 — 总是可用
  const disableSteps: string[] = [];
  disableSteps.push(`从 generated_skill_loader.il 移除 ${targetSkill.name} 的加载`);
  if (hotkeyRefCount > 0 || menuRefCount > 0) {
    disableSteps.push(`快捷键和菜单引用将保留，但命令将变为不可用状态`);
  }
  options.push({
    action: 'just_disable_loader',
    label: '仅禁用加载',
    description: '从 ATM loader 中移除，保留快捷键和菜单引用（标记为失效），不删除文件',
    riskLevel: 'warning',
    steps: disableSteps,
  });

  // 删除并注释快捷键 — 仅在有快捷键引用时提供
  if (hotkeyRefCount > 0) {
    const commentSteps: string[] = [];
    commentSteps.push(`从 generated_skill_loader.il 移除 ${targetSkill.name} 的加载`);
    commentSteps.push(`注释 env 文件中相关的 ${hotkeyRefCount} 个快捷键行`);
    if (menuRefCount > 0) {
      commentSteps.push(`移除 ${menuRefCount} 个菜单引用`);
    }
    commentSteps.push(`创建备份（可回滚）`);
    options.push({
      action: 'delete_and_comment_hotkeys',
      label: '删除并注释快捷键',
      description: '禁用加载 + 注释 env 中相关快捷键，保留文件以备恢复',
      riskLevel: 'warning',
      steps: commentSteps,
    });
  }

  // 删除但标记失效
  const markSteps: string[] = [];
  markSteps.push(`从 generated_skill_loader.il 移除 ${targetSkill.name} 的加载`);
  if (hotkeyRefCount > 0) {
    markSteps.push(`在 env 中添加快捷键失效注释标记`);
  }
  markSteps.push(`创建备份（可回滚）`);
  options.push({
    action: 'delete_but_mark_invalid',
    label: '删除但保留快捷键（标记为失效）',
    description: '禁用加载，快捷键保留在 env 中但标记为失效引用，不删除文件',
    riskLevel: 'warning',
    steps: markSteps,
  });

  // 高级删除（物理删除文件）— 仅非只读
  if (!targetSkill.readonly && targetSkill.tier !== 'company') {
    const advSteps: string[] = [];
    advSteps.push(`备份 ${targetSkill.name} 到 atm_generated/backup/`);
    advSteps.push(`从 generated_skill_loader.il 移除加载`);
    if (hotkeyRefCount > 0) {
      advSteps.push(`注释 env 中相关的 ${hotkeyRefCount} 个快捷键行`);
    }
    advSteps.push(`物理删除 Skill 文件`);
    options.push({
      action: 'advanced_delete',
      label: '高级：删除文件',
      description: '⚠️ 禁用加载 + 备份 + 注释快捷键 + 物理删除 .il 文件（不可恢复）',
      riskLevel: 'danger',
      steps: advSteps,
    });
  }

  return options;
}

/**
 * 查找失效引用（Skill 文件不存在但 env 中仍引用其命令）
 * @param bindings 所有快捷键绑定
 * @param skills 所有 Skill（当前扫描到的）
 */
export function findStaleRefs(
  bindings: HotkeyBinding[],
  skills: SkillFileItem[],
  commandIndex?: CommandIndex,
): StaleRefInfo[] {
  const staleRefs: StaleRefInfo[] = [];
  const idx = commandIndex || (() => {
    const i = new CommandIndex();
    i.build(skills);
    return i;
  })();

  const existingSkillIds = new Set(skills.map((s) => s.id));
  const existingSkillNames = new Set(skills.map((s) => s.name.toLowerCase()));

  for (const binding of bindings) {
    // 跳过无来源关联的绑定
    if (!binding.commandSource || binding.commandSource === 'allegro_builtin' || binding.commandSource === 'unknown') {
      continue;
    }

    const cmdName = binding.command.trim().split(/\s+/)[0]
      .replace(/^["']|["']$/g, '').replace(/[;]$/, '').toLowerCase();

    // 情况 1: skillName 存在但 Skill 不在当前扫描结果中
    if (binding.skillName) {
      const skillExists = existingSkillNames.has(binding.skillName.toLowerCase());
      if (!skillExists) {
        staleRefs.push({
          bindingId: binding.id,
          hotkeyKey: binding.key,
          commandName: cmdName,
          expectedSkillName: binding.skillName,
          expectedSkillPath: binding.skillFilePath || '',
          source: binding.envSourceId || binding.source || '',
          lineNumber: binding.lineNumber || 0,
        });
        continue;
      }
    }

    // 情况 2: skillFilePath 存在但对应的 Skill id 不在结果中
    if (binding.skillFilePath) {
      const skillExists = skills.some(
        (s) => s.path.toLowerCase() === binding.skillFilePath!.toLowerCase() && existingSkillIds.has(s.id),
      );
      if (!skillExists) {
        // 检查 binding 的 command 是否真的被当前 Skill 提供
        const match = idx.find(cmdName);
        if (!match.bestMatch || match.bestMatch.sourceType === 'allegro_builtin') {
          staleRefs.push({
            bindingId: binding.id,
            hotkeyKey: binding.key,
            commandName: cmdName,
            expectedSkillName: binding.skillName || '',
            expectedSkillPath: binding.skillFilePath,
            source: binding.envSourceId || binding.source || '',
            lineNumber: binding.lineNumber || 0,
          });
        }
      }
    }
  }

  return staleRefs;
}

/**
 * 创建删除计划
 * @param targetSkill 目标 Skill
 * @param option 用户选择的处理方式
 * @param envInfo 环境信息（用于获取文件路径）
 */
export function createDeletePlan(
  targetSkill: SkillFileItem,
  option: ImpactOptionAction,
  envInfo: EnvironmentInfo,
): SkillApplyPlan {
  const steps: SkillApplyStep[] = [];
  const warnings: { level: 'info' | 'warning' | 'danger'; message: string }[] = [];
  let requiresRestart = true;

  // 公共步骤：备份
  steps.push({
    type: 'backup',
    target: envInfo.pcbenvPath || '',
    description: `备份配置文件（${targetSkill.name} 删除操作前）`,
  });

  switch (option) {
    case 'just_disable_loader': {
      steps.push({
        type: 'write_skill_loader',
        target: '',
        description: `从 generated_skill_loader.il 移除 ${targetSkill.name} 的加载`,
      });
      warnings.push({
        level: 'warning',
        message: `${targetSkill.name} 的快捷键引用将变为失效状态`,
      });
      break;
    }

    case 'delete_and_comment_hotkeys': {
      steps.push({
        type: 'write_skill_loader',
        target: '',
        description: `从 generated_skill_loader.il 移除 ${targetSkill.name} 的加载`,
      });
      steps.push({
        type: 'modify_ilinit',
        target: envInfo.ilinitFilePath || '',
        description: `注释 env 中 ${targetSkill.entryCommands.length} 个命令的快捷键绑定`,
      });
      warnings.push({
        level: 'warning',
        message: `env 文件中相关快捷键将被注释（保留原始行）`,
      });
      break;
    }

    case 'delete_but_mark_invalid': {
      steps.push({
        type: 'write_skill_loader',
        target: '',
        description: `从 generated_skill_loader.il 移除 ${targetSkill.name} 的加载`,
      });
      warnings.push({
        level: 'info',
        message: `快捷键引用将被标记为失效，保留在 env 中`,
      });
      break;
    }

    case 'advanced_delete': {
      steps.push({
        type: 'backup',
        target: targetSkill.path,
        description: `备份 Skill 文件 ${targetSkill.name}`,
      });
      steps.push({
        type: 'write_skill_loader',
        target: '',
        description: `从 generated_skill_loader.il 移除 ${targetSkill.name} 的加载`,
      });
      steps.push({
        type: 'move_file',
        target: targetSkill.path,
        description: `${targetSkill.name} 物理删除前已备份到 atm_generated/backup/`,
      });
      warnings.push({
        level: 'danger',
        message: `⚠️ ${targetSkill.name} 将被物理删除！备份在 atm_generated/backup/ 中可恢复`,
      });
      break;
    }

    default:
      // cancel 或其他 — 返回空计划
      return {
        id: `plan-cancel-${Date.now()}`,
        createdAt: new Date().toISOString(),
        summary: '操作已取消',
        steps: [],
        warnings: [],
        requiresRestart: false,
      };
  }

  return {
    id: `plan-delete-${Date.now()}`,
    createdAt: new Date().toISOString(),
    summary: `删除 Skill: ${targetSkill.name}（${option}）`,
    steps,
    warnings,
    requiresRestart,
    operation: 'delete',
    targetSkillPath: targetSkill.path,
    targetSkillId: targetSkill.id,
    targetEntryCommands: targetSkill.entryCommands.map(command => command.name),
    deleteOption: option,
  };
}
