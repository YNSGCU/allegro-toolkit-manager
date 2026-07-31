/**
 * ATM - 增强 Skill 扫描模块
 * 在现有扫描结果基础上，增加入口命令/内部函数区分、加载状态、引用信息等
 * V5.4：移除冗余调试日志，使用统一 debug 模块（环境变量 ATM_DEBUG=true 开启）
 */
import fs from 'fs';
import path from 'path';
import { parseSkillFile, enhancedParseSkill } from '../parser/parseSkillMeta';
import { scanAllSkills } from './scanSkill';
import { checkSkillLoad, scanLoadSources } from '../validator/skillLoadChecker';
import { CommandIndex, extractBaseCommand } from './commandIndex';
import { debugLogIf } from '../debug';
import type {
  ScannedSkill,
  SkillFileItem,
  SkillCommandItem,
  SkillFunctionItem,
  SkillParseResult,
  HotkeyReference,
  MenuReference,
  SkillSourceType,
  SkillLoadStatus,
  SkillTier,
} from '../../src/types/skill';
import type { EnvironmentInfo } from '../../src/types/environment';
import type { HotkeyBinding } from '../../src/types/hotkey';

/**
 * 将 ScannedSkill 转换为 SkillFileItem（增强版本）
 * @param skill 原始扫描结果
 * @param parseResult 解析结果
 * @param hotkeyBindings 快捷键绑定列表
 * @param loadStatus 加载状态
 * @param commandIndex 命令索引（若提供则使用 CommandIndex.find() 进行匹配）
 */
export function convertToSkillFileItem(
  skill: ScannedSkill,
  parseResult?: SkillParseResult,
  hotkeyBindings?: HotkeyBinding[],
  loadStatus?: { status: string; sources?: string[]; detail?: string; confidence?: string },
  commandIndex?: CommandIndex,
): SkillFileItem {
  const parse = parseResult || { filePath: skill.filePath, functions: skill.functions };
  const enhancedFuncs = parse.enhancedFunctions || [];
  const rawFuncs = parse.functions;

  // 分离入口命令和内部函数
  const entryCommands: SkillFunctionItem[] = enhancedFuncs.length > 0
    ? enhancedFuncs.filter((f) => f.isEntry)
    : [];
  const internalFunctions: SkillFunctionItem[] = enhancedFuncs.length > 0
    ? enhancedFuncs.filter((f) => !f.isEntry)
    : [];

  // 如果 enhancedFunctions 为空，尝试从原始函数推断
  if (enhancedFuncs.length === 0 && rawFuncs.length > 0) {
    const allFuncs: SkillFunctionItem[] = rawFuncs.map((f) => ({
      name: f.name,
      type: f.type,
      lineNumber: f.lineNumber,
      isEntry: true, // 默认全部标记为入口（保守策略）
      isAxlRegistered: false,
      confidence: 'low' as const,
      reason: '未启用增强解析，默认视为可调用函数',
    }));
    entryCommands.push(...allFuncs);
  }

  // 文件信息
  let fileSize: number | undefined;
  let lastModified: string | undefined;
  try {
    const sourceFiles = skill.sourceFiles?.length ? skill.sourceFiles : [skill.filePath];
    let totalSize = 0;
    let newestModified = 0;
    for (const sourceFile of sourceFiles) {
      if (!fs.existsSync(sourceFile)) continue;
      const stat = fs.statSync(sourceFile);
      totalSize += stat.size;
      newestModified = Math.max(newestModified, stat.mtimeMs);
    }
    if (totalSize > 0) fileSize = totalSize;
    if (newestModified > 0) lastModified = new Date(newestModified).toISOString();
  } catch {
    // ignore
  }

  // 来源类型
  const sourceType: SkillSourceType =
    skill.tier === 'company' ? 'company_skill' :
    skill.tier === 'atm' ? 'atm_managed_skill' :
    skill.tier === 'user' ? 'user_skill' : 'unknown';

  // 加载状态
  let loadStatusVal: SkillLoadStatus = 'unknown';
  if (loadStatus) {
    switch (loadStatus.status) {
      case 'loaded_configured': loadStatusVal = 'loaded_configured'; break;
      case 'maybe_unloaded': loadStatusVal = 'enabled_but_not_loaded'; break;
      case 'readonly_reference': loadStatusVal = 'readonly_reference'; break;
      case 'unknown': loadStatusVal = 'unknown'; break;
      default: loadStatusVal = 'unknown';
    }
  } else {
    loadStatusVal = skill.status === 'enabled' ? 'loaded_configured' : 'disabled';
  }

  // 解析状态
  const parseStatus = parse.error ? 'error' : enhancedFuncs.length > 0 ? 'ok' : 'warning';

  // 快捷键引用
  const hotkeyRefs: HotkeyReference[] = [];
  const hotkeyRefKeys = new Set<string>();
  for (const directRef of parse.directHotkeyRefs || []) {
    const dedupeKey = `${directRef.sourceType || 'skill_direct'}:${directRef.type}:${directRef.key.toLowerCase()}:${directRef.command.toLowerCase()}`;
    if (!hotkeyRefKeys.has(dedupeKey)) {
      hotkeyRefKeys.add(dedupeKey);
      hotkeyRefs.push(directRef);
    }
  }
  if (hotkeyBindings) {
    const cmdNames = new Set(entryCommands.map((f) => f.name.toLowerCase()));
    const allFuncNames = new Set(rawFuncs.map((f) => f.name.toLowerCase()));
    // 额外：收集 axlCmdRegister 注册的外部命令名（来自解析器）
    const axlCmdNames = new Set(
      (parse?.axlRegistrations || []).map(r => r.commandName.toLowerCase())
    );

    for (const binding of hotkeyBindings) {
      let isMatch = false;

      // 优先用 CommandIndex 匹配
      if (commandIndex) {
        const match = commandIndex.find(binding.command);
        if (match.bestMatch && match.bestMatch.sourceSkillId === skill.id) {
          isMatch = true;
        }
      }

      // fallback: 名称匹配逻辑（检查入口命令、函数名、axlCmdRegister 命令名）
      if (!isMatch) {
        const cmdName = extractBaseCommand(binding.command).toLowerCase();
        if (cmdNames.has(cmdName) || allFuncNames.has(cmdName) || axlCmdNames.has(cmdName) || cmdName.includes(skill.name.toLowerCase())) {
          isMatch = true;
        }
      }

      if (isMatch) {
        const ref: HotkeyReference = {
          key: binding.key,
          command: binding.command,
          type: binding.type as 'funckey' | 'alias',
          source: binding.source || '',
          lineNumber: binding.lineNumber || 0,
          sourceType: 'env_binding',
        };
        const dedupeKey = `${ref.sourceType}:${ref.type}:${ref.key.toLowerCase()}:${ref.command.toLowerCase()}`;
        if (!hotkeyRefKeys.has(dedupeKey)) {
          hotkeyRefKeys.add(dedupeKey);
          hotkeyRefs.push(ref);
        }
      }
    }
  }

  const entryCommandItems: SkillCommandItem[] = entryCommands.map((f, idx) => ({
    id: `${skill.id}-cmd-${idx}`,
    name: f.name,
    sourceSkillId: skill.id,
    sourceFile: skill.filePath,
    sourceSkillName: skill.name,
    commandKind: f.isAxlRegistered ? 'axl_registered' : f.type === 'procedure' ? 'procedure' : 'defun',
    isEntry: f.isEntry,
    confidence: f.confidence,
    handlerFunction: f.handlerFunction,
    hotkeys: hotkeyRefs.filter((r) => r.command.toLowerCase().includes(f.name.toLowerCase())).map((r) => r.key),
    menuPaths: [],
    loadStatus: loadStatusVal,
    conflictStatus: 'normal',
    tier: skill.tier,
    skillEnabled: skill.status === 'enabled',
  }));

  return {
    id: skill.id,
    name: skill.name,
    path: skill.filePath,
    dirPath: skill.dirPath,
    sourceType,
    tier: skill.tier,
    readonly: skill.tier === 'company',
    writable: skill.tier !== 'company',
    enabled: skill.status === 'enabled',
    loadStatus: loadStatusVal,
    fileSize,
    lastModified,
    parseStatus,
    parseError: parse.error,
    packageType: skill.sourceFiles && skill.sourceFiles.length > 1
      ? 'directory_package'
      : skill.hasPackageJson
        ? 'atm_package'
        : 'single_file',
    hasPackageJson: skill.hasPackageJson,
    sourceFiles: skill.sourceFiles,
    dependencies: skill.dependencies,
    totalFunctionCount: rawFuncs.length,
    entryCommands: entryCommandItems,
    internalFunctions,
    hotkeyRefs,
    menuRefs: [],
    functions: rawFuncs,
  };
}

function parseScannedSkill(skill: ScannedSkill): SkillParseResult {
  const sourceFiles = skill.sourceFiles?.length ? skill.sourceFiles : [skill.filePath];
  const results = sourceFiles.map((sourceFile) => parseSkillFile(sourceFile));
  const errors = results.flatMap((result) => result.error ? [`${path.basename(result.filePath)}: ${result.error}`] : []);

  return {
    filePath: skill.filePath,
    functions: results.flatMap((result) => result.functions || []),
    enhancedFunctions: results.flatMap((result) => result.enhancedFunctions || []),
    axlRegistrations: results.flatMap((result) => result.axlRegistrations || []),
    directHotkeyRefs: results.flatMap((result) => result.directHotkeyRefs || []),
    error: errors.length > 0 ? errors.join('; ') : undefined,
    parseDetail: {
      entryCount: results.reduce((sum, result) => sum + (result.parseDetail?.entryCount || 0), 0),
      internalCount: results.reduce((sum, result) => sum + (result.parseDetail?.internalCount || 0), 0),
      axlRegistered: results.flatMap((result) => result.parseDetail?.axlRegistered || []),
      heuristicEntry: results.flatMap((result) => result.parseDetail?.heuristicEntry || []),
    },
  };
}

function checkScannedSkillLoad(
  skill: ScannedSkill,
  loadSources: ReturnType<typeof scanLoadSources>,
) {
  const candidateNames = new Set<string>([skill.name]);
  for (const sourceFile of skill.sourceFiles || []) {
    candidateNames.add(path.parse(sourceFile).name);
  }

  const results = [...candidateNames].map((candidate) => checkSkillLoad(candidate, loadSources, null));
  return results.find((result) => result.status === 'loaded_configured') || results[0];
}

/**
 * 扫描并返回增强的 Skill 文件列表
 */
export async function scanEnhancedSkills(
  envInfo: Pick<EnvironmentInfo, 'pcbenvPath' | 'atmGeneratedPath'>
    & Partial<Pick<EnvironmentInfo, 'ilinitFilePath' | 'envFilePath'>>
    & { companySkillPaths?: string[] },
  hotkeyBindings?: HotkeyBinding[],
): Promise<{
  company: SkillFileItem[];
  user: SkillFileItem[];
  atm: SkillFileItem[];
  all: SkillFileItem[];
}> {
  const scanResult = scanAllSkills(envInfo);

  // 解析加载源
  const fullEnvInfo = {
    ...envInfo,
    ilinitFilePath: envInfo.ilinitFilePath
      || (envInfo.pcbenvPath ? path.join(envInfo.pcbenvPath, 'allegro.ilinit') : null),
    envFilePath: envInfo.envFilePath
      || (envInfo.pcbenvPath ? path.join(envInfo.pcbenvPath, 'env') : null),
  } as EnvironmentInfo;
  const loadSources = scanLoadSources(fullEnvInfo);

  const convert = async (skill: ScannedSkill): Promise<SkillFileItem> => {
    const parseResult = parseScannedSkill(skill);
    const loadResult = checkScannedSkillLoad(skill, loadSources);
    return convertToSkillFileItem(skill, parseResult, hotkeyBindings, loadResult);
  };

  const company = await Promise.all(scanResult.company.map(convert));
  const user = await Promise.all(scanResult.user.map(convert));
  const atm = await Promise.all(scanResult.atm.map(convert));

  const all = [...company, ...user, ...atm];

  // 构建 CommandIndex 并同步引用关系
  if (hotkeyBindings && hotkeyBindings.length > 0) {
    const commandIndex = new CommandIndex();
    commandIndex.build(all);
    syncHotkeyRefs(all, hotkeyBindings, commandIndex);
  }

  return {
    company,
    user,
    atm,
    all,
  };
}

/**
 * 构建增强命令列表
 */
export function buildEnhancedCommandList(skills: SkillFileItem[]): SkillCommandItem[] {
  const commands: SkillCommandItem[] = [];
  const seen = new Map<string, number>();

  for (const skill of skills) {
    for (const cmd of skill.entryCommands) {
      const key = cmd.name.toLowerCase();
      const existingIdx = seen.get(key);
      if (existingIdx !== undefined) {
        // 同名命令冲突
        const existing = commands[existingIdx];
        existing.conflictStatus = 'duplicate_command';
        cmd.conflictStatus = 'duplicate_command';
      } else {
        seen.set(key, commands.length);
      }
      commands.push(cmd);
    }
  }

  return commands;
}

/**
 * 检查 Skill 文件的快捷键引用
 * @param commandIndex 命令索引（若提供则使用 CommandIndex 匹配）
 */
export function findHotkeyRefsForSkill(
  skillName: string,
  entryCommands: SkillCommandItem[],
  bindings: HotkeyBinding[],
  commandIndex?: CommandIndex,
): HotkeyReference[] {
  const refs: HotkeyReference[] = [];
  const cmdNames = new Set(entryCommands.map((c) => c.name.toLowerCase()));

  for (const binding of bindings) {
    let isMatch = false;

    // 优先用 CommandIndex 匹配
    if (commandIndex) {
      const match = commandIndex.find(binding.command);
      if (match.bestMatch && match.bestMatch.sourceSkillName?.toLowerCase() === skillName.toLowerCase()) {
        isMatch = true;
      }
    }

    // fallback: 名称匹配
    if (!isMatch) {
      const cmdName = extractBaseCommand(binding.command).toLowerCase();
      if (cmdNames.has(cmdName)) {
        isMatch = true;
      }
    }

    if (isMatch) {
      refs.push({
        key: binding.key,
        command: binding.command,
        type: binding.type as 'funckey' | 'alias',
        source: binding.source || '',
        lineNumber: binding.lineNumber || 0,
      });
    }
  }

  return refs;
}

/**
 * 用 CommandIndex 批量重建所有 Skill 的 hotkeyRefs
 * 在 CommandIndex.build() 完成后调用，确保引用关系最新
 */
export function syncHotkeyRefs(
  skills: SkillFileItem[],
  bindings: HotkeyBinding[],
  commandIndex: CommandIndex,
): void {
  // 构建 skillId → SkillFileItem 映射
  const skillMap = new Map<string, SkillFileItem>();
  for (const skill of skills) {
    skillMap.set(skill.id, skill);
  }

  // 遍历所有绑定，用 CommandIndex 匹配并写入对应 Skill 的 hotkeyRefs
  const refMap = new Map<string, HotkeyReference[]>();
  const refSeenMap = new Map<string, Set<string>>();
  for (const skill of skills) {
    const existingRefs = [...(skill.hotkeyRefs || [])];
    refMap.set(skill.id, existingRefs);
    refSeenMap.set(
      skill.id,
      new Set(
        existingRefs.map((ref) =>
          `${ref.sourceType || 'unknown'}:${ref.type}:${ref.key.toLowerCase()}:${ref.command.toLowerCase()}`,
        ),
      ),
    );
  }

  for (const binding of bindings) {
    let matched = false;

    // 方式 1: CommandIndex 匹配
    const match = commandIndex.find(binding.command);
    if (match.bestMatch && match.bestMatch.sourceSkillId) {
      const skillId = match.bestMatch.sourceSkillId;
      const refs = refMap.get(skillId);
      const seen = refSeenMap.get(skillId);
      if (refs && seen) {
        const nextRef: HotkeyReference = {
          key: binding.key,
          command: binding.command,
          type: binding.type as 'funckey' | 'alias',
          source: binding.source || '',
          lineNumber: binding.lineNumber || 0,
          sourceType: 'env_binding',
        };
        const dedupeKey = `${nextRef.sourceType}:${nextRef.type}:${nextRef.key.toLowerCase()}:${nextRef.command.toLowerCase()}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          refs.push(nextRef);
        }
      }
      matched = true;
    }

    if (!matched) {
      // 方式 2: 针对 axlCmdRegister 命令名做直接匹配（不依赖 CommandIndex）
      const cmdName = extractBaseCommand(binding.command).toLowerCase();
      for (const skill of skills) {
        // 检查技能是否有入口命令名匹配
        const hasMatchingEntry = skill.entryCommands.some(
          (c) => c.name.toLowerCase() === cmdName || c.handlerFunction?.toLowerCase() === cmdName
        );
        if (hasMatchingEntry) {
          const refs = refMap.get(skill.id);
          const seen = refSeenMap.get(skill.id);
          if (refs && seen) {
            const nextRef: HotkeyReference = {
              key: binding.key,
              command: binding.command,
              type: binding.type as 'funckey' | 'alias',
              source: binding.source || '',
              lineNumber: binding.lineNumber || 0,
              sourceType: 'env_binding',
            };
            const dedupeKey = `${nextRef.sourceType}:${nextRef.type}:${nextRef.key.toLowerCase()}:${nextRef.command.toLowerCase()}`;
            if (!seen.has(dedupeKey)) {
              seen.add(dedupeKey);
              refs.push(nextRef);
            }
          }
          break;
        }
      }
    }
  }

  // 写回 SkillFileItem
  for (const skill of skills) {
    const refs = refMap.get(skill.id) || [];
    skill.hotkeyRefs = refs;

    // 同时更新 entryCommands 中的 hotkeys 字段
    for (const cmd of skill.entryCommands) {
      cmd.hotkeys = refs
        .filter((r) => r.command.toLowerCase().includes(cmd.name.toLowerCase()))
        .map((r) => r.key);
    }
  }
}

/**
 * 检查所有未引用 Skill（有入口命令但没有被任何快捷键引用的）
 */
export function findUnreferencedSkills(
  skills: SkillFileItem[],
  bindings: HotkeyBinding[],
): SkillFileItem[] {
  const allRefedNames = new Set<string>();
  for (const binding of bindings) {
    const cmdName = binding.command.trim().split(/\s+/)[0].replace(/^["']|["']$/g, '').replace(/[;]$/, '').toLowerCase();
    allRefedNames.add(cmdName);
  }

  return skills.filter((skill) => {
    if (skill.tier === 'company') return false;
    return !skill.entryCommands.some((cmd) => allRefedNames.has(cmd.name.toLowerCase()));
  });
}
