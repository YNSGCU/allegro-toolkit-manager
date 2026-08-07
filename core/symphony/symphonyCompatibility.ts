/**
 * ATM - Symphony 协同模式兼容体检模块
 *
 * 检查内容：
 *   1. 源码中调用的 AXL 函数是否属于官方 U（Unsupported）类 —— 这类函数
 *      在 Symphony 下的数据库变更不会发送到服务器，导致本地与服务器失步。
 *   2. 已启用 Skill 的入口命令是否登记在 symphony_skill.txt —— 未登记命令
 *      在 Symphony 会话中默认被禁用。
 *   3. ATM 菜单是否具备 Symphony 菜单重建能力（bootstrap 加载 generated_menu.il，
 *      generated_menu.il 注册 'menu 触发器）。
 */
import fs from 'fs';
import path from 'path';
import type { SkillFileItem, SkillCommandItem } from '../../src/types/skill';
import type { EnvironmentInfo } from '../../src/types/environment';
import type {
  AxlCallUsage,
  MuFunctionCategory,
  SymphonyCompatibilityIssue,
  SymphonyCompatibilityResult,
  SymphonyCommandStatus,
} from '../../src/types/symphony';
import { getMuFunctionSupport, MU_CATEGORY_LABELS } from './muFunctionTable';
import { parseSymphonySkillFile } from './symphonySkillFile';

/** 从源码中提取 AXL 函数调用（含行号），自动跳过注释与函数定义行 */
export function extractAxlFunctionCalls(
  content: string,
  sourceFile: string,
): AxlCallUsage[] {
  const calls: AxlCallUsage[] = [];
  const seen = new Set<string>();
  const lines = content.split(/\r?\n/);
  const axlCallRegex = /\b(axl[A-Z][A-Za-z0-9_]*)\b/g;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // 去掉行内注释（引号外分号）
    let inQuote = false;
    let code = rawLine;
    for (let j = 0; j < rawLine.length; j++) {
      if (rawLine[j] === '"') inQuote = !inQuote;
      if (rawLine[j] === ';' && !inQuote) {
        code = rawLine.slice(0, j);
        break;
      }
    }
    const trimmed = code.trim();
    if (!trimmed) continue;

    // 跳过函数定义行（名称出现在定义位置而非调用位置）
    if (
      /^(?:procedure|defun|defunValue)\b/i.test(trimmed) ||
      /^\(\s*(?:procedure|defun|defunValue)\b/i.test(trimmed)
    ) {
      continue;
    }

    axlCallRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = axlCallRegex.exec(code)) !== null) {
      const functionName = match[1];
      const dedupeKey = `${functionName.toLowerCase()}:${i + 1}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const support = getMuFunctionSupport(functionName);
      calls.push({
        functionName,
        category: support.category,
        obsolete: support.obsolete,
        sourceFile,
        lineNumber: i + 1,
      });
    }
  }
  return calls;
}

/** 读取 Skill 的所有源文件内容 */
function readSkillSources(skill: SkillFileItem): Array<{ sourceFile: string; content: string }> {
  const files = skill.sourceFiles && skill.sourceFiles.length > 0
    ? skill.sourceFiles
    : [skill.path];
  const result: Array<{ sourceFile: string; content: string }> = [];
  for (const file of files) {
    try {
      if (fs.existsSync(file)) {
        result.push({ sourceFile: file, content: fs.readFileSync(file, 'utf-8') });
      }
    } catch {
      // 忽略无法读取的源文件
    }
  }
  return result;
}

/** 将 Skill 入口命令转为 Symphony 命令状态 */
function toCommandStatus(
  command: SkillCommandItem,
  registeredNames: Set<string>,
  registeredRw: Set<string>,
): SymphonyCommandStatus {
  const key = command.name.trim().toLowerCase();
  return {
    commandName: command.name,
    skillName: command.sourceSkillName,
    skillId: command.sourceSkillId,
    registered: registeredNames.has(key),
    rw: registeredRw.has(key),
  };
}

/**
 * Symphony 兼容体检
 *
 * @param skills 增强扫描结果（SkillFileItem[]）
 * @param envInfo 环境信息
 * @param symphonyFileContent 现有 symphony_skill.txt 内容（可选，缺失则视为未登记）
 * @returns 体检结果
 */
export function checkSymphonyCompatibility(
  skills: SkillFileItem[],
  envInfo: EnvironmentInfo,
  symphonyFileContent?: string,
): SymphonyCompatibilityResult {
  const checkedAt = new Date().toISOString();
  const issues: SymphonyCompatibilityIssue[] = [];
  const axlCalls: AxlCallUsage[] = [];
  const commandStatuses: SymphonyCommandStatus[] = [];

  // --- symphony_skill.txt 现状 ---
  const symphonyFilePath = envInfo.pcbenvPath
    ? path.join(envInfo.pcbenvPath, 'symphony_skill.txt')
    : null;
  let symphonyExists = false;
  let existingCommands: ReturnType<typeof parseSymphonySkillFile>['commands'] = [];
  if (symphonyFileContent !== undefined) {
    symphonyExists = true;
    existingCommands = parseSymphonySkillFile(symphonyFileContent).commands;
  } else if (symphonyFilePath && fs.existsSync(symphonyFilePath)) {
    try {
      existingCommands = parseSymphonySkillFile(
        fs.readFileSync(symphonyFilePath, 'utf-8'),
      ).commands;
      symphonyExists = true;
    } catch {
      // 读取失败按不存在处理
    }
  }

  const registeredNames = new Set(existingCommands.map((c) => c.name.trim().toLowerCase()));
  const registeredRw = new Set(
    existingCommands.filter((c) => c.rw).map((c) => c.name.trim().toLowerCase()),
  );

  if (!symphonyExists && envInfo.pcbenvPath) {
    issues.push({
      id: 'sym-file-missing',
      severity: 'info',
      type: 'info',
      title: 'symphony_skill.txt 尚未生成',
      description: 'pcbenv 下不存在 symphony_skill.txt，Symphony 会话中所有 SKILL 命令将被禁用。可通过"Symphony 命令登记"生成。',
      suggestedActions: ['生成 symphony_skill.txt（ATM 将按当前启用的 Skill 自动登记入口命令）'],
    });
  }

  // --- 逐 Skill 检查 ---
  const enabledSkills = skills.filter((s) => s.enabled);
  for (const skill of skills) {
    // 1) 源码 AXL 函数调用分类
    const sources = readSkillSources(skill);
    for (const { sourceFile, content } of sources) {
      const calls = extractAxlFunctionCalls(content, sourceFile);
      for (const call of calls) {
        call.skillId = skill.id;
        call.skillName = skill.name;
        axlCalls.push(call);

        if (call.category === 'U') {
          issues.push({
            id: `unsupported-axl-${skill.id}-${call.functionName.toLowerCase()}-${call.lineNumber}`,
            severity: 'error',
            type: 'unsupported_axl',
            title: `函数 ${call.functionName} 在 Symphony 下不受支持`,
            description: `${call.functionName} 属于官方 U（Unsupported）类函数，在 Symphony 会话中其数据库变更不会发送到服务器，会导致本地与服务器失步。建议改造为受支持的 API，或禁用该 Skill 的写操作。`,
            skillId: skill.id,
            skillName: skill.name,
            sourceFile,
            lineNumber: call.lineNumber,
            functionName: call.functionName,
            suggestedActions: [
              '参考 Cadence《Symphony SKILL Development Guide》改用受支持的 AXL API',
              '对命令使用 axlMUTransactionStart/Commit 包裹数据库变更',
              '必要时移除该命令的 rw 登记，避免广播无效更新',
            ],
          });
        }
      }
    }

    // 2) 已启用 Skill 的入口命令登记检查
    if (skill.enabled) {
      for (const command of skill.entryCommands) {
        const status = toCommandStatus(command, registeredNames, registeredRw);
        commandStatuses.push(status);
        if (!status.registered) {
          issues.push({
            id: `command-not-registered-${skill.id}-${command.name.toLowerCase()}`,
            severity: 'warning',
            type: 'command_not_registered',
            title: `命令 ${command.name} 未登记到 symphony_skill.txt`,
            description: `${skill.name} 的入口命令 "${command.name}" 未登记，Symphony 会话中执行将被拒绝。`,
            skillId: skill.id,
            skillName: skill.name,
            commandName: command.name,
            suggestedActions: ['生成/更新 symphony_skill.txt 时勾选该命令'],
          });
        }
      }
    }
  }

  // --- 3) ATM 菜单 Symphony 兼容检查 ---
  const atmDir = envInfo.atmGeneratedPath;
  if (atmDir) {
    const bootstrapPath = path.join(atmDir, 'bootstrap.il');
    const menuIlPath = path.join(atmDir, 'generated_menu.il');
    const bootstrapExists = fs.existsSync(bootstrapPath);
    const menuIlExists = fs.existsSync(menuIlPath);

    if (menuIlExists) {
      const menuContent = fs.readFileSync(menuIlPath, 'utf-8');
      const hasMenuTrigger = /axlTriggerSet\s*\(\s*'menu/i.test(menuContent);
      if (!hasMenuTrigger) {
        issues.push({
          id: 'menu-trigger-missing',
          severity: 'warning',
          type: 'menu_trigger_missing',
          title: 'generated_menu.il 缺少菜单重建触发器',
          description: '未检测到 axlTriggerSet(\'menu ...) 触发器。进入/退出 Symphony 模式时主菜单会重建，ATM 自定义菜单将消失。',
          sourceFile: menuIlPath,
          suggestedActions: ['重新生成 generated_menu.il（现有生成器已内置菜单触发器）'],
        });
      }

      if (!bootstrapExists || !fs.readFileSync(bootstrapPath, 'utf-8').includes('generated_menu.il')) {
        issues.push({
          id: 'menu-load-missing',
          severity: 'warning',
          type: 'menu_load_missing',
          title: 'bootstrap.il 未加载 generated_menu.il',
          description: 'ATM 自定义菜单未接入启动链，Symphony 模式下无法自动恢复菜单。',
          sourceFile: bootstrapPath,
          suggestedActions: ['确保 bootstrap.il 包含 load(".../generated_menu.il")'],
        });
      }
    }
  }

  const unregisteredCommands = commandStatuses.filter((c) => !c.registered);
  const unsupportedCalls = axlCalls.filter((c) => c.category === 'U');
  const supportedCalls = axlCalls.filter((c) => c.category !== 'U');

  return {
    checkedAt,
    environmentId: envInfo.environmentId ?? null,
    pcbenvPath: envInfo.pcbenvPath ?? null,
    symphonyFile: {
      path: symphonyFilePath,
      exists: symphonyExists,
      commandCount: existingCommands.length,
      rwCount: existingCommands.filter((c) => c.rw).length,
    },
    commandStatuses,
    axlCalls,
    unsupportedCalls,
    unregisteredCommands,
    issues,
    stats: {
      totalSkills: skills.length,
      enabledSkills: enabledSkills.length,
      totalCommands: commandStatuses.length,
      registeredCommands: commandStatuses.filter((c) => c.registered).length,
      unregisteredCommands: unregisteredCommands.length,
      rwCommands: commandStatuses.filter((c) => c.rw).length,
      unsupportedAxCalls: unsupportedCalls.length,
      supportedAxCalls: supportedCalls.length,
    },
  };
}

/** AXL 调用分类中文说明（复用 MU_CATEGORY_LABELS） */
export function getAxlCategoryLabel(category: MuFunctionCategory): string {
  return MU_CATEGORY_LABELS[category] || category;
}
