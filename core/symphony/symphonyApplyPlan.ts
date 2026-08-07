/**
 * ATM - Symphony 命令登记 Apply Plan 生成模块
 *
 * 生成 symphony_skill.txt 的写入计划，遵循项目规则：
 * 所有写文件操作必须走 Apply Plan（SHA256 备份 + 变更历史 + 回滚）。
 */
import fs from 'fs';
import path from 'path';
import type { SkillFileItem } from '../../src/types/skill';
import type { EnvironmentInfo } from '../../src/types/environment';
import type { SkillApplyPlan, SkillApplyStep } from '../../src/types/skill';
import type { SymphonyCommandEntry } from '../../src/types/symphony';
import {
  diffSymphonyCommands,
  generateSymphonySkillContent,
  parseSymphonySkillFile,
} from './symphonySkillFile';

/** 生成 Symphony 登记计划的参数 */
export interface CreateSymphonyPlanOptions {
  /** 已启用 Skill 的增强扫描结果 */
  skills: SkillFileItem[];
  /** 需要标记 rw（读写）的命令名列表 */
  rwCommandNames?: string[];
  /** 是否同时同步到 CDS_SITE/PCB（站点级） */
  syncSite?: boolean;
  /** 站点目录（CDS_SITE），syncSite 为 true 时必须提供 */
  sitePath?: string;
  /** 固定生成时间（测试用，默认当前时间） */
  now?: Date;
}

/** 从已启用 Skill 收集 ATM 命令登记条目 */
export function collectSymphonyCommands(
  skills: SkillFileItem[],
  rwCommandNames: string[] = [],
): SymphonyCommandEntry[] {
  const rwSet = new Set(rwCommandNames.map((c) => c.trim().toLowerCase()));
  const commands: SymphonyCommandEntry[] = [];
  const seen = new Set<string>();

  for (const skill of skills) {
    if (!skill.enabled) continue;
    for (const cmd of skill.entryCommands) {
      const key = cmd.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      commands.push({
        name: cmd.name,
        rw: rwSet.has(key),
        source: 'atm',
        skillName: skill.name,
      });
    }
  }

  return commands;
}

/** 获取 symphony_skill.txt 路径（用户级） */
export function getSymphonyFilePath(envInfo: EnvironmentInfo): string {
  return path.join(envInfo.pcbenvPath || '', 'symphony_skill.txt');
}

/**
 * 创建 Symphony 命令登记 Apply Plan
 *
 * 步骤：
 *   1. 备份现有 symphony_skill.txt（存在时）
 *   2. 写入新登记文件（用户级 pcbenv）
 *   3. 可选：同步到 CDS_SITE/PCB（站点级）
 */
export function createSymphonyApplyPlan(
  envInfo: EnvironmentInfo,
  options: CreateSymphonyPlanOptions,
): SkillApplyPlan {
  const now = options.now || new Date();
  const backupId = now.toISOString().replace(/[:.]/g, '-');
  const atmDir = envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
  const backupBase = path.join(atmDir, 'backup', backupId);

  const commands = collectSymphonyCommands(options.skills, options.rwCommandNames || []);
  const userFilePath = getSymphonyFilePath(envInfo);
  const existingContent = fs.existsSync(userFilePath)
    ? fs.readFileSync(userFilePath, 'utf-8')
    : undefined;

  const beforeCommands = existingContent
    ? parseSymphonySkillFile(existingContent).commands
    : [];
  const newContent = generateSymphonySkillContent({
    commands,
    existingContent,
    includeAtmHeader: true,
  });
  const afterCommands = parseSymphonySkillFile(newContent).commands;
  const diff = diffSymphonyCommands(beforeCommands, afterCommands);

  const steps: SkillApplyStep[] = [];
  const warnings: SkillApplyPlan['warnings'] = [];

  // 1. 备份用户级文件
  if (fs.existsSync(userFilePath)) {
    steps.push({
      type: 'backup',
      target: userFilePath,
      description: `备份 symphony_skill.txt（更新前）`,
      backupTo: path.join(backupBase, 'symphony_skill.txt'),
    });
  } else {
    warnings.push({ level: 'info', message: 'symphony_skill.txt 不存在，将新建文件。' });
  }

  // 2. 写入用户级文件
  steps.push({
    type: 'write_file',
    target: userFilePath,
    description: `写入 Symphony 命令登记文件（${afterCommands.length} 条命令，其中 rw ${afterCommands.filter((c) => c.rw).length} 条）`,
    after: newContent,
  });

  // 3. 可选站点级同步
  if (options.syncSite && options.sitePath) {
    const siteDir = path.join(options.sitePath, 'PCB');
    const siteFilePath = path.join(siteDir, 'symphony_skill.txt');
    const siteContent = generateSymphonySkillContent({
      commands,
      existingContent: fs.existsSync(siteFilePath)
        ? fs.readFileSync(siteFilePath, 'utf-8')
        : undefined,
      includeAtmHeader: true,
    });
    if (fs.existsSync(siteFilePath)) {
      steps.push({
        type: 'backup',
        target: siteFilePath,
        description: `备份站点级 symphony_skill.txt（更新前）`,
        backupTo: path.join(backupBase, 'site_symphony_skill.txt'),
      });
    }
    steps.push({
      type: 'write_file',
      target: siteFilePath,
      description: `同步 Symphony 命令登记到站点级 ${siteFilePath}`,
      after: siteContent,
    });
  }

  if (diff.removed.length > 0) {
    warnings.push({
      level: 'warning',
      message: `以下命令将从登记中移除（对应 Skill 已禁用或不再暴露入口命令）：${diff.removed.join('、')}`,
    });
  }
  if (diff.rwChanged.length > 0) {
    warnings.push({
      level: 'warning',
      message: `以下命令的 rw 标记发生变化：${diff.rwChanged.join('、')}`,
    });
  }

  const summaryParts: string[] = [];
  if (diff.added.length > 0) summaryParts.push(`新增 ${diff.added.length} 条`);
  if (diff.removed.length > 0) summaryParts.push(`移除 ${diff.removed.length} 条`);
  if (diff.rwChanged.length > 0) summaryParts.push(`rw 变更 ${diff.rwChanged.length} 条`);

  return {
    id: `symphony-sync-${backupId}`,
    createdAt: now.toISOString(),
    summary: `同步 Symphony 命令登记（${afterCommands.length} 条命令${summaryParts.length ? `：${summaryParts.join('，')}` : ''}）`,
    steps,
    warnings,
    requiresRestart: false,
    operation: 'sync-symphony-file',
    targetFiles: steps
      .filter((s) => s.type === 'write_file' && s.target)
      .map((s) => s.target as string),
    targetEntryCommands: afterCommands.map((c) => c.name),
  };
}
