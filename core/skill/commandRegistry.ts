import { parseSkillFile } from '../parser/parseSkillMeta';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ScannedSkill,
  CommandEntry,
  CommandRegistry,
  SkillRefCheck,
  SkillRefValidationResult,
} from '../../src/types/skill';
import type { HotkeyBinding } from '../../src/types/hotkey';

import { ALLEGRO_BUILTIN_COMMANDS } from '../validator/commandClassifier';

const DOC_HINT_EXTENSIONS = ['.txt', '.md', '.markdown'];
const DOC_COMMAND_PATTERNS = [
  /(?:功能)?默认命令\s*[:：]?\s*([A-Za-z_][A-Za-z0-9_-]*)/gi,
  /funckey\s+"[^"]+"\s+"([A-Za-z_][A-Za-z0-9_-]*)"/gi,
  /alias\s+[^"\s]+\s+"([A-Za-z_][A-Za-z0-9_-]*)"/gi,
];

function extractDocHintCommands(skillFilePath: string): string[] {
  const dirPath = path.dirname(skillFilePath);
  const skillBaseName = path.parse(skillFilePath).name.toLowerCase();
  const commands = new Set<string>();

  try {
    const entries = fs.readdirSync(dirPath, { encoding: 'utf-8' });
    const candidateDocs = entries.filter((entry) => {
      const lower = entry.toLowerCase();
      if (!DOC_HINT_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
        return false;
      }

      return lower.includes(skillBaseName);
    });

    for (const docFileName of candidateDocs) {
      const docPath = path.join(dirPath, docFileName);
      let content = '';

      try {
        content = fs.readFileSync(docPath, 'utf8');
      } catch {
        continue;
      }

      for (const pattern of DOC_COMMAND_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          const commandName = match[1]?.trim();
          if (commandName) {
            commands.add(commandName);
          }
        }
      }
    }
  } catch {
    return [];
  }

  return Array.from(commands);
}

function buildEntriesForSkill(skill: ScannedSkill): CommandEntry[] {
  const entries: CommandEntry[] = [];
  const seenCommands = new Set<string>();
  let functions = skill.functions;
  let axlRegistrations: Array<{ commandName: string }> = [];
  const docHintCommands = extractDocHintCommands(skill.filePath);

  try {
    const parseResult = parseSkillFile(skill.filePath);
    if (functions.length === 0) {
      functions = parseResult.functions;
    }
    axlRegistrations = parseResult.axlRegistrations || [];
  } catch {
    if (functions.length === 0) {
      return entries;
    }
  }

  for (const func of functions) {
    seenCommands.add(func.name.toLowerCase());
    entries.push({
      commandName: func.name,
      type: func.type,
      skillFilePath: skill.filePath,
      skillName: skill.name,
      tier: skill.tier,
      skillEnabled: skill.status === 'enabled',
    });
  }

  for (const registration of axlRegistrations) {
    const normalizedName = registration.commandName.toLowerCase();
    if (seenCommands.has(normalizedName)) {
      continue;
    }

    seenCommands.add(normalizedName);
    entries.push({
      commandName: registration.commandName,
      type: 'procedure',
      skillFilePath: skill.filePath,
      skillName: skill.name,
      tier: skill.tier,
      skillEnabled: skill.status === 'enabled',
    });
  }

  for (const commandName of docHintCommands) {
    const normalizedName = commandName.toLowerCase();
    if (seenCommands.has(normalizedName)) {
      continue;
    }

    seenCommands.add(normalizedName);
    entries.push({
      commandName,
      type: 'procedure',
      skillFilePath: skill.filePath,
      skillName: skill.name,
      tier: skill.tier,
      skillEnabled: skill.status === 'enabled',
    });
  }

  return entries;
}

export function buildCommandRegistry(skills: ScannedSkill[]): CommandRegistry {
  const entriesMap: Record<string, CommandEntry[]> = {};

  let companyCount = 0;
  let userCount = 0;
  let atmCount = 0;

  for (const skill of skills) {
    const skillEntries = buildEntriesForSkill(skill);

    for (const entry of skillEntries) {
      const key = entry.commandName.toLowerCase();
      if (!entriesMap[key]) {
        entriesMap[key] = [];
      }
      entriesMap[key].push(entry);

      switch (entry.tier) {
        case 'company':
          companyCount++;
          break;
        case 'user':
          userCount++;
          break;
        case 'atm':
          atmCount++;
          break;
      }
    }
  }

  return {
    entries: entriesMap,
    stats: {
      totalCommands: Object.keys(entriesMap).length,
      companyCommands: companyCount,
      userCommands: userCount,
      atmCommands: atmCount,
    },
  };
}

export function findCommand(
  registry: CommandRegistry,
  commandName: string,
): CommandEntry[] | null {
  const key = commandName.toLowerCase();
  return registry.entries[key] || null;
}

export function hasRegisteredCommands(registry: CommandRegistry): boolean {
  return registry.stats.totalCommands > 0;
}

export function findUnresolvedRefs(
  registry: CommandRegistry,
  bindings: HotkeyBinding[],
): SkillRefValidationResult {
  const checks: SkillRefCheck[] = [];
  const stats = {
    resolved: 0,
    unresolved: 0,
    disabledSkill: 0,
    companySkill: 0,
    ambiguous: 0,
  };

  for (const binding of bindings) {
    if (!binding.command || binding.command.trim() === '') {
      continue;
    }

    const rawName = binding.command.trim().split(/\s+/)[0];
    const commandName = rawName.replace(/^["']|["']$/g, '').replace(/[;]$/, '');

    if (ALLEGRO_BUILTIN_COMMANDS.has(commandName.toLowerCase())) {
      stats.resolved++;
      checks.push({
        command: commandName,
        type: 'resolved',
        matches: [],
        severity: 'info',
        message: `快捷键命令 "${commandName}" 是 Allegro 内置命令，无需 Skill 定义`,
      });
      continue;
    }

    const matches = findCommand(registry, commandName);

    if (!matches || matches.length === 0) {
      stats.unresolved++;
      checks.push({
        command: commandName,
        type: 'unresolved',
        matches: [],
        severity: 'error',
        message: `快捷键 "${binding.type} ${binding.key}" 的命令 "${commandName}" 没有找到对应的 Skill 定义`,
      });
      continue;
    }

    if (matches.length > 1) {
      const allEnabled = matches.every((match) => match.skillEnabled);
      stats.ambiguous++;
      checks.push({
        command: commandName,
        type: 'ambiguous',
        matches,
        severity: allEnabled ? 'warning' : 'error',
        message: `命令 "${commandName}" 在多个 Skill 中都有定义：${matches.map((match) => match.skillName).join(', ')}`,
      });
      continue;
    }

    const match = matches[0];

    if (!match.skillEnabled) {
      stats.disabledSkill++;
      checks.push({
        command: commandName,
        type: 'disabled_skill',
        matches: [match],
        severity: 'error',
        message: `快捷键 "${binding.type} ${binding.key}" 的命令 "${commandName}" 对应的 Skill "${match.skillName}" 已禁用`,
      });
      continue;
    }

    if (match.tier === 'company') {
      stats.companySkill++;
      checks.push({
        command: commandName,
        type: 'company_skill',
        matches: [match],
        severity: 'warning',
        message: `快捷键命令 "${commandName}" 对应公司只读 Skill "${match.skillName}"，可引用但不能直接修改`,
      });
      continue;
    }

    stats.resolved++;
    checks.push({
      command: commandName,
      type: 'resolved',
      matches: [match],
      severity: 'info',
      message: `快捷键命令 "${commandName}" 已匹配到 Skill "${match.skillName}"`,
    });
  }

  return { checks, stats };
}
